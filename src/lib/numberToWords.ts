// Indian-system amount in words. Shared by print-bill aur print-estimate.

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function helper(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n] + " ";
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "") + " ";
  return ONES[Math.floor(n / 100)] + " Hundred " + helper(n % 100);
}

/** Whole rupees → "One Thousand Two Hundred Rupees Only". */
export function numberToWords(num: number): string {
  if (!Number.isFinite(num)) return "Zero Rupees Only";
  num = Math.floor(Math.abs(num));
  if (num === 0) return "Zero Rupees Only";
  let w = "";
  const cr = Math.floor(num / 10000000);
  num %= 10000000;
  const lk = Math.floor(num / 100000);
  num %= 100000;
  const th = Math.floor(num / 1000);
  num %= 1000;
  if (cr) w += helper(cr) + "Crore ";
  if (lk) w += helper(lk) + "Lakh ";
  if (th) w += helper(th) + "Thousand ";
  w += helper(num);
  return w.trim() + " Rupees Only";
}
