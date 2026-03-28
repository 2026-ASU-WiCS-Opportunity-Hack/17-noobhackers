/**
 * Contact page — Executive Director email as primary contact.
 * Requirement: 1.6
 */

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
      <h1 className="text-4xl font-bold text-wial-gray-900">Contact Us</h1>
      <p className="mt-4 text-lg text-wial-gray-600">
        We would love to hear from you. Reach out to our team for any inquiries
        about Action Learning, certification, or chapter partnerships.
      </p>

      <div className="mt-10 rounded-xl border border-wial-gray-200 p-8">
        <h2 className="text-xl font-bold text-wial-gray-900">
          Executive Director
        </h2>
        <p className="mt-2 text-wial-gray-600">
          For general inquiries, partnerships, and certification questions:
        </p>
        <a
          href="mailto:info@wial.org"
          className="mt-4 inline-block text-lg font-medium text-wial-blue hover:text-wial-blue-light"
        >
          info@wial.org
        </a>
      </div>

      <div className="mt-8 rounded-xl border border-wial-gray-200 p-8">
        <h2 className="text-xl font-bold text-wial-gray-900">
          Chapter Inquiries
        </h2>
        <p className="mt-2 text-wial-gray-600">
          Interested in starting a WIAL chapter in your region? Contact us to
          learn about becoming an affiliate.
        </p>
        <a
          href="mailto:chapters@wial.org"
          className="mt-4 inline-block text-lg font-medium text-wial-blue hover:text-wial-blue-light"
        >
          chapters@wial.org
        </a>
      </div>
    </div>
  );
}
