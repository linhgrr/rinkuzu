"use client";

import { ArrowRight, CircleCheck } from "lucide-react";
import { useState } from "react";

// In Linux, the path must match exactly if the OS is case-sensitive. 
// However, if Button.tsx exists, we should use Buttom/Card or lowercase if Next handles it.
// Next handles case sensitivity per OS, so we'll use lowercase and modify if needed.
import { Button } from "@/components/ui/Button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/Card";
import { Separator } from "@/components/ui/Separator";
import { Switch } from "@/components/ui/Switch";

export interface PricingFeature {
    text: string;
}

export interface PricingPlan {
    id: string;
    name: string;
    description: string;
    monthlyPrice: string;
    yearlyPrice: string;
    features: PricingFeature[];
    button: {
        text: string;
        url: string;
    };
}

export interface Pricing2Props {
    heading?: string;
    description?: string;
    plans?: PricingPlan[];
}

const Pricing2 = ({
    heading = "Pricing",
    description = "Check out our affordable pricing plans",
    plans = [
        {
            id: "plus",
            name: "Plus",
            description: "For personal use",
            monthlyPrice: "$19",
            yearlyPrice: "$15",
            features: [
                { text: "Up to 5 team members" },
                { text: "Basic components library" },
                { text: "Community support" },
                { text: "1GB storage space" },
            ],
            button: {
                text: "Purchase",
                url: "https://www.shadcnblocks.com",
            },
        },
        {
            id: "pro",
            name: "Pro",
            description: "For professionals",
            monthlyPrice: "$49",
            yearlyPrice: "$35",
            features: [
                { text: "Unlimited team members" },
                { text: "Advanced components" },
                { text: "Priority support" },
                { text: "Unlimited storage" },
            ],
            button: {
                text: "Purchase",
                url: "https://www.shadcnblocks.com",
            },
        },
    ],
}: Pricing2Props) => {
    const [isYearly, setIsYearly] = useState(false);
    return (
        <section className="py-32">
            <div className="container px-4">
                <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
                    <h2 className="text-pretty text-4xl font-bold lg:text-6xl">
                        {heading}
                    </h2>
                    <p className="text-muted-foreground lg:text-xl">{description}</p>
                    <div className="flex items-center gap-3 text-lg">
                        Monthly
                        <Switch
                            checked={isYearly}
                            onCheckedChange={() => setIsYearly(!isYearly)}
                        />
                        Yearly
                    </div>
                    <div className="flex flex-col items-stretch justify-center gap-6 md:flex-row">
                        {plans.map((plan) => (
                            <Card
                                key={plan.id}
                                className="flex w-full md:w-80 flex-col justify-between text-left"
                            >
                                <CardHeader>
                                    <CardTitle>
                                        <p>{plan.name}</p>
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground">
                                        {plan.description}
                                    </p>
                                    <span className="text-4xl font-bold">
                                        {isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                                    </span>
                                    {(() => {
                                        const priceStr = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
                                        const numericMatch = priceStr.match(/^\$(\d+(\.\d{2})?)$/);
                                        if (!numericMatch) return null;
                                        const annualAmount = (parseFloat(numericMatch[1]) * 12).toFixed(2);
                                        return (
                                            <p className="text-muted-foreground">
                                                Billed ${annualAmount} annually
                                            </p>
                                        );
                                    })()}
                                </CardHeader>
                                <CardContent>
                                    <Separator className="mb-6" />
                                    {plan.id === "pro" && (
                                        <p className="mb-3 font-semibold">
                                            Everything in Plus, and:
                                        </p>
                                    )}
                                    <ul className="space-y-4">
                                        {plan.features.map((feature, index) => (
                                            <li key={index} className="flex items-center gap-2">
                                                <CircleCheck className="size-4" />
                                                <span>{feature.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter className="mt-auto">
                                    <Button className="w-full" onClick={() => window.open(plan.button.url, "_blank")}>
                                        {plan.button.text}
                                        <ArrowRight className="ml-2 size-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export { Pricing2 };
