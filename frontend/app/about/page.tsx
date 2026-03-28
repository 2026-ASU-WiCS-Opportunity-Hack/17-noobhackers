/**
 * About WIAL page — static content about the organization.
 * Requirement: 7.1
 */

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
      <h1 className="text-4xl font-bold text-wial-gray-900">About WIAL</h1>

      <div className="mt-8 space-y-6 text-lg leading-relaxed text-wial-gray-700">
        <p>
          The World Institute for Action Learning (WIAL) is a global non-profit
          organization dedicated to advancing the practice of Action Learning
          across more than 20 countries. Founded on the principles developed by
          Reg Revans, WIAL provides a structured methodology that helps teams
          solve complex, real-world problems while simultaneously developing
          leadership capabilities.
        </p>

        <p>
          Our mission is to certify and support Action Learning Coaches who
          facilitate transformative learning experiences in organizations of all
          sizes. Through our four-tier certification program (CALC, PALC, SALC,
          MALC), we ensure that coaches meet the highest standards of practice.
        </p>

        <h2 className="pt-4 text-2xl font-bold text-wial-gray-900">Our Approach</h2>
        <p>
          Action Learning brings together small groups of people to address real
          challenges while learning through questioning and reflection. A
          certified WIAL coach guides the process, ensuring that both the problem
          and the learning receive equal attention.
        </p>

        <h2 className="pt-4 text-2xl font-bold text-wial-gray-900">Global Reach</h2>
        <p>
          With chapters spanning North America, South America, Europe, Africa,
          Asia, and Oceania, WIAL connects a diverse community of practitioners
          who share a commitment to learning-driven leadership development.
        </p>
      </div>
    </div>
  );
}
