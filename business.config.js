// =========================================================================
//  EDIT THIS FILE FOR EACH CLIENT. Nothing else needs to change.
//  The bot only answers from what you write here, so keep it accurate.
//  Delete or change anything that is not true for your business.
// =========================================================================

export default {
  // What visitors see in the website widget
  brand: {
    name: "Vaibhav Singh",
    color: "#1d4ed8",            // launcher, header and customer bubbles
    greeting:
      "Hello! I can tell you about Vaibhav Singh's website, chatbot and WhatsApp bot services, or take your details for a quote. How can I help?",
    quickReplies: ["What services do you offer?", "Get a quote", "See your work", "How does it work?"],
  },

  // Facts the bot is allowed to use
  business: {
    description:
      "Freelance developer who builds business websites, AI chatbots for websites, and WhatsApp bots for small and growing businesses.",
    address: "",                 // optional, for example a city or "Remote, worldwide"
    phone: "",                   // optional
    email: "",                   // add your business email here so the bot can share it
    website: "https://github.com/VaibhavSingh557",
    timezone: "",                // for example "Asia/Kolkata". Lets the bot say if you are available now
    hours: [],                   // for example ["Mon-Fri: 10:00-18:00"]
    services: [
      { name: "Business website", price: "Quoted per project", details: "Fast, mobile-friendly sites for services and shops" },
      { name: "Website AI chatbot", price: "Quoted per project", details: "A chat widget that answers customer questions from your own business details" },
      { name: "WhatsApp business bot", price: "Quoted per project", details: "Answers customer messages on WhatsApp using the same business details" },
      { name: "Custom tools and automation", price: "Quoted per project", details: "Small custom software to save time on repeated work" },
    ],
    faqs: [
      { q: "How do I get a quote?", a: "Tell us what you need through the Leave your details form in this chat. Include your name, a phone number or email, and a short description of the project." },
      { q: "Can the chatbot be customised for my business?", a: "Yes. The bot is set up with your services, prices, opening hours and FAQs, and it uses your brand color." },
      { q: "Does the chatbot work on WhatsApp too?", a: "Yes. The same bot can answer customers on your website and on WhatsApp." },
      { q: "Who pays for the AI usage?", a: "The AI provider bills usage to your own account, so you stay in control of the cost." },
    ],
    policies: [
      "Prices depend on the scope of each project, so every project is quoted individually.",
    ],
  },

  // How the bot behaves
  bot: {
    name: "Assistant",
    tone: "professional, friendly and concise",
    // Shown to the model as extra rules. Add as many as the business needs.
    rules: [
      "Never state a price, deadline or guarantee that is not listed above. Say that projects are quoted individually.",
      "Do not make claims about past clients, results or experience that are not listed above.",
      "When someone wants a quote or to start a project, ask them to use the Leave your details form, or collect their name, contact details and a short project description.",
    ],
    // What to say when the bot does not know something
    fallback:
      "I don't have that detail, but you can use the Leave your details form and Vaibhav will get back to you.",
  },

  limits: {
    maxHistoryTurns: 12,      // how many past messages the bot remembers
    maxMessageChars: 1000,    // longest message a visitor can send
    rateLimitPerMinute: 20,   // per IP address
  },
};
