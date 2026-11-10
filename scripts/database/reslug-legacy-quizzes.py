"""RIN-1515: apply a plan from scripts/reslug-legacy-quizzes.mjs to MongoDB.

Runs inside the API container (pymongo, MONGODB_URI in the environment; the
URI is read in memory and never printed). The caller prepends one line,
``PARAMS = json.loads(r'''{...}''')``, and pipes the file to ``python -``:

  {"mode": "export", "slugs": [...]}            read-only: candidates + taken slugs
  {"mode": "backup", "renames": [...]}          read-only: what apply would change
  {"mode": "apply", "renames": [...]}           forward plan
  {"mode": "revert", "steps": [...]}            plan from --revert-backup

Besides the quiz, two collections key a learner's data on the quiz slug and
are renamed with it: questionprogresses.quizSlug and bookmarks.quiz.slug.
Attempts keep their historical quizSnapshot.slug (links resolve through
slugAliases); reports and premium submissions key on the quiz id.
"""

import datetime
import json
import os

from bson import ObjectId
from pymongo import MongoClient

DB_NAME = "rinkuzu"
DEPENDENTS = (("questionprogresses", "quizSlug"), ("bookmarks", "quiz.slug"))

params = PARAMS  # noqa: F821  (prepended by the caller)
client = MongoClient(os.environ["MONGODB_URI"], serverSelectionTimeoutMS=10000)
db = client[DB_NAME]
quizzes = db["quizzes"]


def emit(value):
    print(json.dumps(value, default=str, ensure_ascii=False, indent=2))


def dependent_ids(slug):
    return {
        name: [str(doc["_id"]) for doc in db[name].find({field: slug}, {"_id": 1})]
        for name, field in DEPENDENTS
    }


def rename_dependents(old, new):
    return {
        name: db[name].update_many({field: old}, {"$set": {field: new}}).modified_count
        for name, field in DEPENDENTS
    }


def taken_by_other(quiz_id, slug):
    return quizzes.find_one(
        {"_id": {"$ne": quiz_id}, "$or": [{"slug": slug}, {"slugAliases": slug}]},
        {"_id": 1},
    )


def export():
    fields = {"_id": 1, "title": 1, "slug": 1}
    candidates = [
        {"_id": str(doc["_id"]), "title": doc.get("title", ""), "slug": doc["slug"]}
        for doc in quizzes.find({"slug": {"$in": params["slugs"]}}, fields)
    ]
    taken = set()
    for doc in quizzes.find({}, {"slug": 1, "slugAliases": 1}):
        taken.add(doc["slug"])
        taken.update(doc.get("slugAliases") or [])
    emit({"candidates": candidates, "takenSlugs": sorted(taken)})


def backup():
    out = []
    for rename in params["renames"]:
        doc = quizzes.find_one(
            {"_id": ObjectId(rename["_id"])},
            {"slug": 1, "slugAliases": 1, "updatedAt": 1},
        )
        if doc is None or doc["slug"] != rename["from"]:
            raise SystemExit(f"quiz {rename['_id']} no longer has slug {rename['from']}")
        out.append(
            {
                "_id": rename["_id"],
                "slug": doc["slug"],
                "newSlug": rename["to"],
                "slugAliases": doc.get("slugAliases"),
                "updatedAt": doc.get("updatedAt"),
                "dependents": dependent_ids(doc["slug"]),
            }
        )
    emit({"takenAt": datetime.datetime.utcnow().isoformat() + "Z", "quizzes": out})


def apply():
    now = datetime.datetime.utcnow()
    results = []
    for rename in params["renames"]:
        quiz_id = ObjectId(rename["_id"])
        if taken_by_other(quiz_id, rename["to"]):
            results.append({"_id": rename["_id"], "status": "skipped: collision"})
            continue
        res = quizzes.update_one(
            {"_id": quiz_id, "slug": rename["from"]},
            {
                "$set": {"slug": rename["to"], "updatedAt": now},
                "$addToSet": {"slugAliases": rename["from"]},
            },
        )
        if res.modified_count != 1:
            results.append({"_id": rename["_id"], "status": "skipped: slug changed"})
            continue
        moved = rename_dependents(rename["from"], rename["to"])
        results.append({"_id": rename["_id"], "status": "applied", "dependents": moved})
    emit({"appliedAt": now.isoformat() + "Z", "results": results})


def revert():
    now = datetime.datetime.utcnow()
    results = []
    for step in params["steps"]:
        quiz_id = ObjectId(step["_id"])
        aliases = step["slugAliases"]
        update = {"$set": {"slug": step["to"], "updatedAt": now}}
        if aliases is None:
            update["$unset"] = {"slugAliases": ""}
        else:
            update["$set"]["slugAliases"] = aliases
        res = quizzes.update_one({"_id": quiz_id, "slug": step["from"]}, update)
        if res.modified_count != 1:
            results.append({"_id": step["_id"], "status": "skipped: slug changed"})
            continue
        moved = rename_dependents(step["from"], step["to"])
        results.append({"_id": step["_id"], "status": "reverted", "dependents": moved})
    emit({"revertedAt": now.isoformat() + "Z", "results": results})


{"export": export, "backup": backup, "apply": apply, "revert": revert}[params["mode"]]()
