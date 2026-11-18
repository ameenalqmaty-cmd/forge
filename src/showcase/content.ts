import {
  BookOpen, CalendarCheck, Coins, Crown, Flame, Gamepad2, Gem, GraduationCap, Heart, Hotel, MessageCircle,
  PartyPopper, Receipt, Star, Swords, Target, Trophy, Users, Wallet, Briefcase, type LucideIcon,
} from "lucide-react";
import type { ThemeId } from "@/lib/theme";

type Content = {
  app: string; logo: LucideIcon; greeting: string; sub: string;
  hero: { eyebrow: string; title: string; body: string; cta: string; icon: LucideIcon };
  stats: { icon: LucideIcon; label: string; value: string; delta?: number; tone: "primary" | "accent" | "success" | "warning" }[];
  listTitle: string;
  list: { name: string; sub: string; badge: string; tone: "default" | "success" | "warning" | "accent" }[];
  progress: { title: string; value: number; label: string };
};

// Sample content per theme — shows how the same components fit different app types.
export const CONTENT: Record<ThemeId, Content> = {
  calm: {
    app: "دفتر", logo: Briefcase, greeting: "صباح الخير، أحمد", sub: "هذا ملخص أعمالك لهذا الأسبوع",
    hero: { eyebrow: "تقرير نوفمبر جاهز", title: "الإيرادات ارتفعت ١٨٪", body: "أفضل أسبوع منذ بداية الربع. راجع التفاصيل وصدّر التقرير.", cta: "عرض التقرير", icon: Receipt },
    stats: [
      { icon: Wallet, label: "الإيرادات", value: "٤٢٬٨٠٠", delta: 18, tone: "primary" },
      { icon: Receipt, label: "فواتير معلّقة", value: "١٢", delta: -4, tone: "warning" },
      { icon: Users, label: "عملاء نشطون", value: "٢٣٨", delta: 6, tone: "success" },
      { icon: Coins, label: "متوسط الطلب", value: "١٨٠", delta: 2, tone: "accent" },
    ],
    listTitle: "آخر الفواتير",
    list: [
      { name: "شركة الواحة للتجارة", sub: "فاتورة #1042 · ٣٬٢٠٠ د.ل", badge: "مدفوعة", tone: "success" },
      { name: "مؤسسة النخبة", sub: "فاتورة #1041 · ١٬٨٥٠ د.ل", badge: "معلّقة", tone: "warning" },
      { name: "مكتب الريادة", sub: "فاتورة #1040 · ٩٠٠ د.ل", badge: "مدفوعة", tone: "success" },
      { name: "متجر البيان", sub: "فاتورة #1039 · ٤٬١٠٠ د.ل", badge: "مسودة", tone: "default" },
    ],
    progress: { title: "هدف الربع", value: 68, label: "٦٨٪ من ٢٠٠ ألف" },
  },
  playful: {
    app: "شلّتنا", logo: PartyPopper, greeting: "هلا يا أحمد 👋", sub: "الشلة متحمسة الليلة",
    hero: { eyebrow: "طلعة الخميس", title: "١٢ صديق قالوا: جايين!", body: "صوّت على المكان قبل الساعة ٨ مساءً.", cta: "صوّت الآن", icon: PartyPopper },
    stats: [
      { icon: MessageCircle, label: "رسائل جديدة", value: "٤٨", tone: "primary" },
      { icon: Heart, label: "تفاعلات", value: "٢٣٠", delta: 32, tone: "accent" },
      { icon: Users, label: "أعضاء الشلة", value: "١٨", tone: "success" },
      { icon: Flame, label: "أيام متتالية", value: "٢٧", tone: "warning" },
    ],
    listTitle: "نشاط الشلة",
    list: [
      { name: "سالم", sub: "أرسل صورة في المجموعة", badge: "الآن", tone: "accent" },
      { name: "مروان", sub: "صوّت لمقهى البحر", badge: "٥د", tone: "default" },
      { name: "عبدالله", sub: "انضم لطلعة الخميس", badge: "١٢د", tone: "success" },
      { name: "يوسف", sub: "علّق: مين جاي؟ 😂", badge: "١س", tone: "default" },
    ],
    progress: { title: "تحدّي الشهر", value: 45, label: "٩ من ٢٠ طلعة" },
  },
  luxe: {
    app: "إقامة", logo: Gem, greeting: "مساء الخير، أحمد", sub: "حجوزاتك القادمة وعروض حصرية",
    hero: { eyebrow: "عرض الأعضاء", title: "جناح ملكي بإطلالة بحرية", body: "خصم ٢٥٪ على الإقامات فوق ٣ ليالٍ حتى نهاية الشهر.", cta: "احجز الآن", icon: Crown },
    stats: [
      { icon: CalendarCheck, label: "حجوزات قادمة", value: "٣", tone: "primary" },
      { icon: Star, label: "نقاط الولاء", value: "١٢٬٤٠٠", delta: 12, tone: "accent" },
      { icon: Hotel, label: "إقامات هذا العام", value: "٩", tone: "success" },
      { icon: Crown, label: "مستوى العضوية", value: "ذهبي", tone: "warning" },
    ],
    listTitle: "حجوزاتك",
    list: [
      { name: "فندق المرسى — جناح ديلوكس", sub: "٢٤–٢٧ نوفمبر · ٣ ليالٍ", badge: "مؤكد", tone: "success" },
      { name: "منتجع الواحة", sub: "١٢–١٤ ديسمبر · ليلتان", badge: "بانتظار الدفع", tone: "warning" },
      { name: "قاعة اللؤلؤة — عشاء خاص", sub: "٣١ ديسمبر · ٨ مساءً", badge: "مؤكد", tone: "success" },
    ],
    progress: { title: "الطريق إلى البلاتيني", value: 62, label: "١٢٬٤٠٠ / ٢٠٬٠٠٠ نقطة" },
  },
  edu: {
    app: "مركز التحفيظ", logo: BookOpen, greeting: "السلام عليكم، أستاذ أحمد", sub: "حلقة الفجر · ٢٤ طالباً",
    hero: { eyebrow: "تسميع اليوم", title: "٨ طلاب بانتظار التسميع", body: "ابدأ جلسة التسميع وسجّل الدرجات مباشرة.", cta: "ابدأ التسميع", icon: GraduationCap },
    stats: [
      { icon: Users, label: "الحضور اليوم", value: "٢١/٢٤", tone: "primary" },
      { icon: BookOpen, label: "صفحات هذا الأسبوع", value: "١٨٦", delta: 9, tone: "success" },
      { icon: Trophy, label: "ختمات هذا العام", value: "٤", tone: "accent" },
      { icon: Target, label: "متوسط الإتقان", value: "٩١٪", delta: 3, tone: "warning" },
    ],
    listTitle: "طلاب الحلقة",
    list: [
      { name: "محمد علي", sub: "سورة الكهف · الوجه ٤", badge: "ممتاز", tone: "success" },
      { name: "عمر خالد", sub: "سورة مريم · الوجه ٢", badge: "جيد جداً", tone: "default" },
      { name: "يوسف سالم", sub: "سورة طه · الوجه ٧", badge: "يحتاج مراجعة", tone: "warning" },
      { name: "حمزة أحمد", sub: "سورة الأنبياء · الوجه ١", badge: "ممتاز", tone: "success" },
    ],
    progress: { title: "خطة الحلقة الشهرية", value: 74, label: "٧٤٪ من الخطة" },
  },
  game: {
    app: "تحدّي", logo: Gamepad2, greeting: "جاهز يا بطل؟ ⚡", sub: "الموسم ٣ · ينتهي بعد ٥ أيام",
    hero: { eyebrow: "تحدّي يومي", title: "اربح ٣ جولات متتالية", body: "المكافأة: ٥٠٠ عملة + شارة البرق.", cta: "العب الآن", icon: Swords },
    stats: [
      { icon: Trophy, label: "الترتيب", value: "#١٢", delta: 4, tone: "primary" },
      { icon: Coins, label: "العملات", value: "٣٬٢٥٠", tone: "warning" },
      { icon: Flame, label: "سلسلة الفوز", value: "٧", tone: "accent" },
      { icon: Star, label: "المستوى", value: "٢٤", tone: "success" },
    ],
    listTitle: "لوحة الصدارة",
    list: [
      { name: "Falcon_LY", sub: "المستوى ٣١ · ٩٨ فوز", badge: "#١", tone: "warning" },
      { name: "نمر_الصحراء", sub: "المستوى ٢٩ · ٩١ فوز", badge: "#٢", tone: "accent" },
      { name: "ShadowX", sub: "المستوى ٢٨ · ٨٧ فوز", badge: "#٣", tone: "accent" },
      { name: "أنت", sub: "المستوى ٢٤ · ٦٢ فوز", badge: "#١٢", tone: "success" },
    ],
    progress: { title: "تقدّم الموسم", value: 58, label: "المستوى ٢٤ → ٢٥" },
  },
};
