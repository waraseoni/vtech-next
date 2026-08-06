export const DEFAULT_TEMPLATES: Record<string, string> = {
  whatsapp_welcome:
`नमस्ते {client_name} जी! 🙏

आपका {firm_name} में हार्दिक स्वागत है! 🛠️✨

हम आपके सभी इलेक्ट्रॉनिक उपकरणों की मरम्मत एवं देखभाल के लिए समर्पित हैं:

🔧 SMPS / Power Supply Repair
🔧 EV Charger Repair
🔧 Stage Light Repair
🔧 DMX Controller Repair
🔧 इलेक्ट्रॉनिक गैजेट्स सर्विस

🎯 हमारी विशेषताएं:
• जेनुइन पार्ट्स
• एक्सपर्ट टेक्नीशियन
• समय पर डिलीवरी
• किफायती मूल्य

📞 संपर्क: {firm_phone}
📍 लोकेशन: {firm_address}
⏰ समय: सुबह 10:00 - शाम 8:00

नए ग्राहकों के लिए विशेष ऑफर: पहली सर्विस पर 10% छूट! 🎁

किसी भी समस्या के लिए हमें कॉल या WhatsApp करें!

धन्यवाद,
{firm_owner}
{firm_name}`,

  whatsapp_reminder:
`नमस्ते {client_name} जी! 🙏

आपका बकाया बैलेंस (सेवा + लोन) *₹{balance}* है।

कृपया शीघ्र भुगतान करने का कष्ट करें।

🔸 *Payment Methods:*
• Cash (Shop पर)
• Bank Transfer
• UPI/Google Pay

🔸 *Payment Details:*
Account: {firm_name}
Contact: {firm_phone}

आपका समय देने के लिए धन्यवाद! 🙏

{firm_owner}
{firm_name}`,

  whatsapp_followup:
`नमस्ते {client_name} जी! 🙏

आप कैसे हैं? 🤗

{firm_name} में आपका स्वागत है।

🎁 *विशेष ऑफर:* पुराने ग्राहकों के लिए 15% छूट!

🔧 *नई सेवाएं:*
• फ्री डायग्नोसिस
• इमरजेंसी रिपेयर

📞 कॉल करें: {firm_phone}
📍 आ जाएँ: {firm_address}

आपकी प्रतीक्षा में...

धन्यवाद,
{firm_owner}
{firm_name}`,

  whatsapp_offer:
`नमस्ते {client_name} जी! 🎉

{firm_name} की तरफ से विशेष ऑफर!

🔥 *मौसम में छूट!*

• 20% OFF

⏰ *ऑफर वैलिडिटी:* इस महीने तक

📞 बुक करें: {firm_phone}
📍 लोकेशन: {firm_address}

जल्दी करें, ऑफर सीमित समय के लिए! ⏳

धन्यवाद,
{firm_owner}
{firm_name}`,

  whatsapp_greeting:
`नमस्ते {client_name} जी! 🙏

{firm_name} की तरफ से आपका दिन शुभ हो! 🌟

हम आपकी सेवा में सदैव तत्पर हैं।

किसी भी इलेक्ट्रॉनिक समस्या के लिए संपर्क करें।

📞 {firm_phone}
📍 {firm_address}

शुभकामनाएँ!
{firm_owner}`,

  whatsapp_sale:
`नमस्ते {client_name} जी! 🙏

आपके {firm_name} से किए गए आर्डर/सेल ({sale_code}) का कुल बिल *₹{total_amount}* है।

खरीदारी के लिए धन्यवाद! 🛒

📞 संपर्क: {firm_phone}
📍 लोकेशन: {firm_address}

धन्यवाद,
{firm_owner}
{firm_name}`,

  whatsapp_status_pending:
`नमस्ते {client_name} जी 🙏!

आपका *{item}* (Job ID: #{job_id}) (Code: #{code}) repair के लिए प्राप्त हुआ है। 📝

Status: *Pending (Queue में है)*

हम जल्द ही चेक करके आपको अपडेट देंगे।

धन्यवाद ❤️
{firm_owner}
{firm_name}
📞 {firm_phone}
📍 {firm_address}`,

  whatsapp_status_repairing:
`नमस्ते {client_name} जी 🙏!

आपके *{item}* (Job ID: #{job_id}) (Code: #{code}) पर काम शुरू कर दिया गया है। 🛠️

Status: *In-Progress / Repairing*

हमारे टेक्नीशियन इसे जल्द से जल्द ठीक करने की कोशिश कर रहे हैं। ✨

धन्यवाद ❤️
{firm_owner}
{firm_name}
📞 {firm_phone}`,

  whatsapp_status_ready:
`नमस्ते {client_name} जी 🙏!

आपका *{item}* repair complete हो गया है ✅

📋 *Details:*
Job ID: #{job_id}
Code: #{code}
Bill Amount: *₹{amount}*
Status: *Ready for Delivery*

आप वर्कशॉप पर आकर अपना डिवाइस कलेक्ट कर सकते हैं। 🛍️

धन्यवाद ❤️
{firm_owner}
{firm_name}
📞 {firm_phone}
📍 {firm_address}`,

  whatsapp_status_delivered:
`नमस्ते {client_name} जी 🙏!

आपका *{item}* (Job ID: #{job_id}) (Code: #{code}) सफलतापूर्वक deliver कर दिया गया है। 🏁

Total Paid: *₹{amount}*
Status: *Delivered / Paid*

{firm_name} की सेवा लेने के लिए धन्यवाद! अपना कीमती फीडबैक जरूर दें। ⭐

धन्यवाद ❤️
{firm_owner}
{firm_name}
📞 {firm_phone}`,

  whatsapp_status_cancelled:
`नमस्ते {client_name} जी 🙏!

आपका Job ID: #{job_id} (Code: #{code}) (*{item}*) का आर्डर cancel कर दिया गया है। ❌

कृपया अधिक जानकारी के लिए हमसे संपर्क करें।

धन्यवाद 🙏
{firm_owner}
{firm_name}
📞 {firm_phone}`,
};

export const TEMPLATE_LABELS: Record<string, string> = {
  whatsapp_welcome: "Welcome Message",
  whatsapp_reminder: "Payment Reminder",
  whatsapp_followup: "Follow-up Message",
  whatsapp_offer: "Offer / Discount",
  whatsapp_greeting: "Greeting / Shubhkaamna",
  whatsapp_sale: "Direct Sale Notification",
  whatsapp_status_pending: "Job Received / Pending",
  whatsapp_status_repairing: "Job In-Progress",
  whatsapp_status_ready: "Job Ready / Repaired",
  whatsapp_status_delivered: "Job Delivered / Paid",
  whatsapp_status_cancelled: "Job Cancelled",
};

export const PLACEHOLDERS: Record<string, string> = {
  "{client_name}": "Client ka naam",
  "{firm_name}": "Aapka shop/firm ka naam",
  "{firm_phone}": "Firm ka phone number",
  "{firm_address}": "Firm ka address",
  "{firm_owner}": "Owner/Firm ka naam",
  "{balance}": "Client ka pending balance (₹)",
  "{item}": "Repair item ka naam",
  "{job_id}": "Transaction/Job ID",
  "{code}": "Job ka unique code",
  "{amount}": "Bill/Payment amount",
  "{sale_code}": "Direct sale ka code",
  "{total_amount}": "Sale ka total amount",
};
