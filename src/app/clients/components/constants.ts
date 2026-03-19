import { inr } from './helpers';

export const FIRM = { name: "V-Technologies", phone: "9179105875", address: "Jabalpur, MP", owner: "Vikram Jain" };

export const WA = {
  welcome:  (n: string) =>
    `नमस्ते ${n} जी! 🙏\n\n${FIRM.name} में आपका स्वागत है! 🛠️✨\n\n🔧 SMPS / Power Supply Repair\n🔧 Stage Light Repair\n🔧 DMX Controller Repair\n\n🎯 जेनुइन पार्ट्स • एक्सपर्ट टेक्नीशियन • किफायती मूल्य\n\n📞 ${FIRM.phone}\n📍 ${FIRM.address}\n\nधन्यवाद,\n${FIRM.owner}`,
  reminder: (n: string, bal: number) =>
    `नमस्ते ${n} जी! 🙏\n\nआपका बकाया बैलेंस *${inr(bal)}* है।\n\nकृपया शीघ्र भुगतान करने का कष्ट करें।\n\n🔸 Payment Methods:\n• Cash (Shop पर)\n• UPI / Google Pay\n• Bank Transfer\n\n📞 ${FIRM.phone}\n\nधन्यवाद,\n${FIRM.owner}`,
  followup: (n: string) =>
    `नमस्ते ${n} जी! 🙏\n\n${FIRM.name} से आपकी याद आई! 🤗\n\n🎁 पुराने ग्राहकों के लिए विशेष ऑफर: 15% छूट!\n\n📞 ${FIRM.phone}\n📍 ${FIRM.address}\n\nधन्यवाद,\n${FIRM.owner}`,
  offer:    (n: string) =>
    `नमस्ते ${n} जी! 🎉\n\n${FIRM.name} की तरफ से विशेष ऑफर!\n\n🔥 20% OFF — इस महीने तक!\n\n📞 ${FIRM.phone}\nधन्यवाद,\n${FIRM.owner}`,
};