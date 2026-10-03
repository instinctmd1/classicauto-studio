/* Customer deliveries and testimonials. Both lists start empty on purpose (rule N6: reviews are real).
   Every entry needs written consent: { consent: { date, method, file }, source, date } or reviews.js
   refuses to show it.

   DELIVERIES:   { photo: "assets/reviews/<file>.webp", car: "2025 Tata Safari", name: "First name only", date: "2026-10-03", source: "Instagram @classicauto_1974", consent: { date: "2026-10-03", method: "WhatsApp message", file: "consent/2026-10-03-name.png" } }
   TESTIMONIALS: { quote: "Words exactly as the customer wrote them.", name: "Name, area", car: "2025 Tata Safari", date: "2026-10-03", source: "Google", consent: { ... } } */
var DELIVERIES = [];
var TESTIMONIALS = [];
