import type { Metadata } from 'next';
import Link from 'next/link';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/terms',
    title: 'Terms of Service | RinKuzu',
    description:
      'RinKuzu Terms of Service — Usage terms, content policies, AI-generated content rights, subscription terms, and liability limitations.',
  });
}

export default async function TermsPage({ params }: Props) {
  await params;

  return (
    <section className="max-w-4xl mx-auto space-y-10 py-16 px-6">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-neutral-500">Last updated: March 27, 2026</p>
      </div>

      <p className="text-neutral-700 leading-relaxed">
        Welcome to RinKuzu. These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
        use of the RinKuzu platform operated by Hanoi University of Science and Technology
        (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) at{' '}
        <strong>https://www.rinkuzu.app</strong> (the &ldquo;Platform&rdquo;). By accessing or using
        RinKuzu, you (&ldquo;you&rdquo; or &ldquo;User&rdquo;) agree to be bound by these Terms. If
        you do not agree to these Terms, do not access or use the Platform.
      </p>

      <div className="space-y-8 text-neutral-700 leading-relaxed">
        {/* Section 1 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">1. Acceptance of Terms</h2>
          <p>
            By creating an account, logging in, or otherwise using any feature of RinKuzu, you
            confirm that you: (a) are at least 13 years of age, or have the express consent of a
            parent or guardian if under 18; (b) have the legal capacity to enter into a binding
            agreement; and (c) are not barred from using the Platform under applicable law. If you
            are accepting these Terms on behalf of an organization, you represent that you have
            authority to bind that organization to these Terms.
          </p>
        </div>

        {/* Section 2 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">
            2. Account Registration and Security
          </h2>
          <div className="space-y-3">
            <h3 className="font-medium text-neutral-800">2.1 Account Creation</h3>
            <p>
              You must provide accurate, complete, and current information during registration. You
              may not register under a false identity or on behalf of someone else without proper
              authorization. Accounts are non-transferable.
            </p>

            <h3 className="font-medium text-neutral-800">2.2 Account Security</h3>
            <p>
              You are solely responsible for maintaining the confidentiality of your login
              credentials (email and password) and for all activities that occur under your account.
              You must notify us immediately at{' '}
              <a href="mailto:support@rinkuzu.app" className="text-brand-trust hover:underline">
                support@rinkuzu.app
              </a>{' '}
              if you become aware of any unauthorized use of your account. We are not liable for any
              loss or damage arising from unauthorized use of your credentials.
            </p>

            <h3 className="font-medium text-neutral-800">2.3 Account Termination</h3>
            <p>
              We reserve the right to suspend or terminate your account at our sole discretion if
              you violate these Terms, engage in prohibited conduct, or pose a security risk to the
              Platform or its users. We will provide reasonable notice where practicable unless
              immediate termination is required for legal compliance or security reasons.
            </p>
          </div>
        </div>

        {/* Section 3 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">3. Description of Service</h2>
          <p>
            RinKuzu is an AI-powered adaptive learning platform that transforms PDF documents into
            personalized quiz-based learning experiences using knowledge graphs and Bloom&apos;s
            Taxonomy. Core features include:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>PDF-to-quiz generation using Google Gemini AI</li>
            <li>Adaptive learning sessions with SAINT-Bloom knowledge tracing</li>
            <li>Curriculum sequencing using Dueling DQN reinforcement learning</li>
            <li>Knowledge graph visualization of prerequisite concepts</li>
            <li>Mastery tracking across six Bloom&apos;s Taxonomy cognitive levels</li>
            <li>Community quiz sharing and browsing</li>
          </ul>
          <p className="mt-3">
            We reserve the right to modify, suspend, or discontinue any feature of RinKuzu at any
            time with reasonable notice. We will endeavor to announce material changes via email or
            the Platform.
          </p>
        </div>

        {/* Section 4 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">
            4. Subscription Plans and Billing
          </h2>
          <div className="space-y-3">
            <h3 className="font-medium text-neutral-800">4.1 Free Plan</h3>
            <p>
              The Free plan provides access to core PDF-to-quiz generation and adaptive practice
              features at no cost. The Free plan is provided as-is and may be modified or
              discontinued at our discretion with reasonable notice.
            </p>

            <h3 className="font-medium text-neutral-800">4.2 Premium Plan</h3>
            <p>
              The Premium plan provides additional features including: priority concept
              recommendation, advanced quiz analytics, team management, and priority email support.
              Pricing for Premium is determined on a per-user or team basis. Contact us at{' '}
              <a href="mailto:support@rinkuzu.app" className="text-brand-trust hover:underline">
                support@rinkuzu.app
              </a>{' '}
              for custom pricing for teams and institutions.
            </p>

            <h3 className="font-medium text-neutral-800">4.3 Billing and Payment</h3>
            <p>
              Payments are processed securely via PayOS. You authorize us to charge your chosen
              payment method for all fees associated with your Premium subscription. All fees are in
              USD or VND as displayed at checkout and are non-refundable except as required by
              applicable law. Recurring subscriptions renew automatically at the end of each billing
              period unless cancelled at least 7 days before renewal. View our{' '}
              <Link href="/privacy" className="text-brand-trust hover:underline">
                Privacy Policy
              </Link>{' '}
              for payment data handling details.
            </p>

            <h3 className="font-medium text-neutral-800">4.4 Cancellation</h3>
            <p>
              You may cancel your Premium subscription at any time through your account settings.
              Cancellation takes effect at the end of the current billing period. Downgrading to the
              Free plan does not entitle you to a refund for the current period.
            </p>
          </div>
        </div>

        {/* Section 5 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">5. Acceptable Use Policy</h2>
          <p className="mb-3">You agree NOT to use RinKuzu to:</p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>
              Upload, generate, or share content that is unlawful, defamatory, obscene, harassing,
              discriminatory, or hateful
            </li>
            <li>
              Upload PDF documents you do not own or lack the right to distribute (e.g., copyrighted
              textbooks without permission)
            </li>
            <li>
              Use the Platform to Spam, distribute malware, or conduct automated scraping beyond
              personal learning use
            </li>
            <li>
              Attempt to gain unauthorized access to any account, system, or network connected to
              RinKuzu
            </li>
            <li>
              Use RinKuzu to build a competing product or service without our prior written consent
            </li>
            <li>
              Reverse engineer, decompile, or disassemble any part of the RinKuzu software or AI
              systems
            </li>
            <li>
              Use AI-generated content from RinKuzu in ways that violate academic integrity policies
              at your institution
            </li>
            <li>
              Share quiz content from copyrighted textbooks in public quizzes without proper
              authorization
            </li>
            <li>Interfere with or disrupt the integrity or performance of the Platform</li>
            <li>Violate any applicable local, national, or international law</li>
          </ul>
          <p className="mt-3">
            Violations may result in immediate account suspension or termination, and may be
            reported to law enforcement authorities where required by law.
          </p>
        </div>

        {/* Section 6 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">
            6. Content Ownership and Rights
          </h2>
          <div className="space-y-3">
            <h3 className="font-medium text-neutral-800">6.1 Your Content</h3>
            <p>
              You retain all ownership rights to content you upload to RinKuzu, including PDFs,
              documents, and any text you submit. By uploading content, you grant us a limited,
              worldwide, non-exclusive, royalty-free license to process, store, and use that content
              solely to provide the RinKuzu service to you. We do not claim ownership of your
              uploaded materials.
            </p>

            <h3 className="font-medium text-neutral-800">6.2 AI-Generated Quizzes</h3>
            <p>
              Quizzes and explanations generated by Google Gemini AI through RinKuzu are considered
              part of the RinKuzu service. You may use AI-generated quizzes for personal study,
              classroom, or non-commercial educational purposes. Redistribution of AI-generated quiz
              content as standalone commercial products is prohibited without our prior written
              consent.
            </p>

            <h3 className="font-medium text-neutral-800">6.3 Community Quizzes</h3>
            <p>
              When you create a quiz and set it to &ldquo;public,&rdquo; you grant other users a
              limited license to take and review that quiz within the Platform. You represent that
              you have the right to share any content included in public quizzes. We reserve the
              right to remove public quizzes that violate these Terms.
            </p>

            <h3 className="font-medium text-neutral-800">6.4 RinKuzu Intellectual Property</h3>
            <p>
              The RinKuzu name, logo, website design, software, algorithms (including SAINT-Bloom
              knowledge tracing and Dueling DQN curriculum sequencing), and all other RinKuzu
              proprietary technology are the exclusive property of Hanoi University of Science and
              Technology. No license to use RinKuzu&apos;s intellectual property is granted beyond
              the limited right to use the Platform as intended.
            </p>
          </div>
        </div>

        {/* Section 7 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">
            7. Third-Party Services and Content
          </h2>
          <p>
            RinKuzu uses third-party services including Google Gemini AI, Vercel, and MongoDB Atlas.
            These services are subject to their own terms and privacy policies. We do not control
            and are not responsible for the content, accuracy, or practices of any third-party
            websites or services linked to or from RinKuzu. Your use of third-party services is at
            your own risk. We recommend reviewing the privacy policies and terms of any third-party
            services before use.
          </p>
        </div>

        {/* Section 8 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">
            8. Disclaimer of Warranties
          </h2>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-amber-900">IMPORTANT: PLEASE READ CAREFULLY</p>
            <p className="text-sm text-amber-800">
              RinKuzu is provided &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; without
              warranties of any kind, express or implied, including but not limited to implied
              warranties of merchantability, fitness for a particular purpose, title, and
              non-infringement.
            </p>
            <p className="text-sm text-amber-800">
              We do not warrant that: (a) the Platform will be uninterrupted, secure, or error-free;
              (b) AI-generated quizzes will be 100% accurate or free of errors; (c) results obtained
              from the use of the Platform will meet your specific requirements; or (d) any errors
              in the software will be corrected. You acknowledge that AI systems are inherently
              probabilistic and may produce inaccurate, incomplete, or inappropriate content.
            </p>
          </div>
        </div>

        {/* Section 9 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">
            9. Limitation of Liability
          </h2>
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 space-y-2">
            <p className="text-sm text-neutral-700">
              To the maximum extent permitted by applicable law, in no event shall Hanoi University
              of Science and Technology, its trustees, officers, employees, agents, or affiliates be
              liable for any indirect, incidental, special, consequential, or punitive damages,
              including without limitation:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-700">
              <li>Loss of profits, revenue, goodwill, or anticipated savings</li>
              <li>Cost of replacement services or data loss</li>
              <li>Any claim arising from your use of or reliance on AI-generated content</li>
              <li>Any claim arising from unauthorized access to your account</li>
              <li>Any act or omission of a third party</li>
            </ul>
            <p className="text-sm text-neutral-700 pt-2">
              Our total cumulative liability arising from or relating to these Terms or your use of
              RinKuzu shall not exceed the greater of: (a) USD 100 (one hundred United States
              dollars), or (b) the total fees paid by you to us in the 12 months preceding the event
              giving rise to the claim.
            </p>
            <p className="text-sm text-neutral-700">
              These limitations apply regardless of whether the claim is based on contract, tort,
              strict liability, or any other legal theory, and even if we have been advised of the
              possibility of such damages.
            </p>
            <p className="text-sm font-semibold text-neutral-700 pt-2">
              Exceptions: The above limitations do not apply to liability which cannot be limited
              under applicable law (e.g., Intentional misconduct, gross negligence) or to matters
              where such limitation would be unenforceable under Vietnamese law or GDPR.
            </p>
          </div>
        </div>

        {/* Section 10 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">10. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless Hanoi University of Science and
            Technology, its trustees, officers, employees, and agents from and against any and all
            claims, damages, losses, costs, and expenses (including reasonable legal fees) arising
            from or relating to: (a) your violation of these Terms; (b) your misuse of the Platform;
            (c) your violation of any third-party right (including intellectual property or privacy
            rights); or (d) your uploaded content. We reserve the right, at your expense, to assume
            the exclusive defense and control of any matter subject to indemnification, and you
            agree to cooperate with our defense.
          </p>
        </div>

        {/* Section 11 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">11. Academic Integrity</h2>
          <p>
            RinKuzu is a learning tool designed to support your education. You are responsible for
            complying with the academic integrity policies of your school, university, or
            institution. Using RinKuzu to cheat on exams, assignments, or assessments, including
            generating answers that you submit as your own work without proper attribution, may
            violate academic integrity policies and could result in disciplinary action by your
            institution. RinKuzu is not responsible for how you use the Platform in relation to
            academic requirements at your institution.
          </p>
        </div>

        {/* Section 12 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">
            12. Governing Law and Dispute Resolution
          </h2>
          <div className="space-y-3">
            <p>
              These Terms are governed by and construed in accordance with the laws of the{' '}
              <strong>Socialist Republic of Vietnam</strong>, without regard to its conflict of law
              provisions.
            </p>
            <p>
              Any dispute arising from or relating to these Terms or your use of RinKuzu shall first
              be attempted to be resolved through good-faith negotiation between the parties. If the
              dispute cannot be resolved through negotiation within 30 days, either party may submit
              the dispute to the competent courts of Hanoi, Vietnam.
            </p>
            <p>
              For users in the EEA: notwithstanding the above, you may also file a complaint with
              your local Alternative Dispute Resolution (ADR) body or with the European
              Commission&apos;s Online Dispute Resolution platform.
            </p>
          </div>
        </div>

        {/* Section 13 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">
            13. Modifications to Terms
          </h2>
          <p>
            We may modify these Terms from time to time. We will notify you of material changes by
            posting the updated Terms on this page and updating the &ldquo;Last updated&rdquo; date.
            Material changes will be communicated via email to your registered address at least{' '}
            <strong>14 days</strong> before they take effect. Your continued use of RinKuzu after
            the effective date of any modified Terms constitutes your acceptance of the modified
            Terms. If you do not agree to the modified Terms, you must stop using the Platform and
            delete your account.
          </p>
        </div>

        {/* Section 14 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">
            14. Severability and Waiver
          </h2>
          <p>
            If any provision of these Terms is held to be invalid, illegal, or unenforceable by a
            court of competent jurisdiction, that provision shall be modified to the minimum extent
            necessary to make it valid and enforceable, or if modification is not possible, it shall
            be severed. The remaining provisions shall remain in full force and effect. The failure
            of either party to enforce any provision shall not constitute a waiver of that provision
            or any other provision.
          </p>
        </div>

        {/* Section 15 */}
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-3">15. Contact Information</h2>
          <ul className="list-none space-y-2 text-sm">
            <li>
              <strong>RinKuzu / Hanoi University of Science and Technology</strong>
            </li>
            <li>
              Address: Room 302, Building A1, 17 Dai Co Viet Street, Hai Ba Trung District, Hanoi,
              Vietnam
            </li>
            <li>
              Email:{' '}
              <a href="mailto:support@rinkuzu.app" className="text-brand-trust hover:underline">
                support@rinkuzu.app
              </a>
            </li>
            <li>Website: https://www.rinkuzu.app</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
