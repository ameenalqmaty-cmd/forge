import { useEffect, useRef, useState } from "react";
import {
  Bell, Check, Inbox, Lock, LogOut, Mail, Moon, Palette, Plus, Search, Shield, Smartphone, Sun, Tablet, Monitor, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetClose } from "@/components/ui/sheet";
import { Avatar, EmptyState, Progress, Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/shell/AppShell";
import { HeroCard, ListGroup, ListRow, SectionTitle, StatCard } from "@/blocks";
import { THEMES, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { CONTENT } from "./content";
import { pct } from "@/lib/format";

/* ------------------------------ Home ------------------------------ */
export function HomeScreen() {
  const { theme } = useTheme();
  const c = CONTENT[theme];
  return (
    <div className="animate-rise" key={theme}>
      <PageHeader title={c.greeting} subtitle={c.sub} action={<Button size="sm" variant="outline" className="hidden sm:inline-flex"><Plus />جديد</Button>} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <HeroCard eyebrow={c.hero.eyebrow} title={c.hero.title} body={c.hero.body} icon={c.hero.icon}
            action={<Button variant="secondary" className="bg-white text-neutral-900 hover:bg-white/90">{c.hero.cta}</Button>} />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-2">
            {c.stats.map((s) => <StatCard key={s.label} {...s} />)}
          </div>
        </div>
        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold">{c.progress.title}</span>
              <Badge>{pct(c.progress.value)}</Badge>
            </div>
            <Progress value={c.progress.value} />
            <p className="mt-2 text-sm text-muted-foreground">{c.progress.label}</p>
          </Card>
          <div>
            <SectionTitle title={c.listTitle} action={<Button variant="link" size="sm" className="px-0">عرض الكل</Button>} />
            <ListGroup>
              {c.list.map((r) => (
                <ListRow key={r.name} leading={<Avatar name={r.name} />} title={r.name} subtitle={r.sub} chevron={false}
                  trailing={<Badge variant={r.tone}>{r.badge}</Badge>} />
              ))}
            </ListGroup>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Components --------------------------- */
export function ComponentsScreen() {
  const [loading, setLoading] = useState(true);
  return (
    <div className="animate-rise space-y-6">
      <PageHeader title="المكوّنات" subtitle="كل ما يبني منه Claude الشاشات — بنفس الثيم" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>الأزرار</CardTitle><CardDescription>كلها بارتفاع ٤٤px على الأقل لسهولة اللمس</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button>أساسي</Button><Button variant="secondary">ثانوي</Button><Button variant="outline">محدد</Button>
            <Button variant="accent">مميز</Button><Button variant="ghost">شفاف</Button><Button variant="destructive">حذف</Button>
            <Button size="icon" aria-label="إشعارات"><Bell /></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>الحقول</CardTitle><CardDescription>خط ١٦px — لا تكبير مفاجئ في iPhone</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Input icon={<Search />} placeholder="ابحث…" />
            <Field label="البريد الإلكتروني" error="صيغة البريد غير صحيحة"><Input type="email" defaultValue="ahmed@" /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>الشارات والمفاتيح</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>افتراضي</Badge><Badge variant="solid">ممتلئ</Badge><Badge variant="success">مكتمل</Badge>
              <Badge variant="warning">معلّق</Badge><Badge variant="destructive">ملغي</Badge><Badge variant="outline">مسودة</Badge>
            </div>
            <label className="flex items-center justify-between gap-3"><span>الإشعارات</span><Switch defaultChecked /></label>
            <label className="flex items-center justify-between gap-3"><span>الوضع الصامت</span><Switch /></label>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>التبويبات والنوافذ</CardTitle><CardDescription>النافذة: لوحة سفلية في الهاتف، وسط الشاشة في التابلت</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="a">
              <TabsList className="w-full"><TabsTrigger value="a">اليوم</TabsTrigger><TabsTrigger value="b">الأسبوع</TabsTrigger><TabsTrigger value="c">الشهر</TabsTrigger></TabsList>
              <TabsContent value="a" className="text-sm text-muted-foreground">محتوى اليوم</TabsContent>
              <TabsContent value="b" className="text-sm text-muted-foreground">محتوى الأسبوع</TabsContent>
              <TabsContent value="c" className="text-sm text-muted-foreground">محتوى الشهر</TabsContent>
            </Tabs>
            <Sheet title="إضافة عنصر" description="مثال على نافذة متجاوبة" trigger={<Button variant="outline" block><Plus />افتح النافذة</Button>}>
              <div className="space-y-3">
                <Field label="الاسم"><Input placeholder="اكتب الاسم" /></Field>
                <Field label="ملاحظات" hint="اختياري"><Input placeholder="…" /></Field>
                <SheetClose asChild><Button block>حفظ</Button></SheetClose>
              </div>
            </Sheet>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>حالة التحميل</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setLoading((l) => !l)}>{loading ? "أظهر المحتوى" : "أظهر التحميل"}</Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-3"><Skeleton className="size-11 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></div>)}</div>
            ) : (
              <div className="space-y-3">{["سارة محمود", "خالد يوسف", "ليلى أحمد"].map((n) => <div key={n} className="flex items-center gap-3"><Avatar name={n} /><div><div className="font-medium">{n}</div><div className="text-sm text-muted-foreground">متصل الآن</div></div></div>)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>الحالة الفارغة</CardTitle><CardDescription>إلزامية في كل قائمة — لا مساحات بيضاء</CardDescription></CardHeader>
          <EmptyState icon={<Inbox />} title="لا توجد رسائل بعد" description="عندما تصلك رسائل ستظهر هنا." action={<Button size="sm"><Plus />رسالة جديدة</Button>} />
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------ Auth ------------------------------ */
export function AuthScreen() {
  const { theme } = useTheme();
  const c = CONTENT[theme];
  return (
    <div className="animate-rise grid min-h-[70dvh] place-items-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-card"><c.logo className="size-8" /></div>
          <h1 className="text-fluid-2xl font-bold">مرحباً بك في {c.app}</h1>
          <p className="mt-1 text-muted-foreground">سجّل الدخول للمتابعة</p>
        </div>
        <Card className="space-y-4 p-5 sm:p-6">
          <Field label="البريد الإلكتروني"><Input icon={<Mail />} type="email" inputMode="email" autoComplete="email" placeholder="name@example.com" dir="ltr" /></Field>
          <Field label="كلمة المرور"><Input icon={<Lock />} type="password" autoComplete="current-password" placeholder="••••••••" dir="ltr" /></Field>
          <Button block size="lg">تسجيل الدخول</Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />أو<div className="h-px flex-1 bg-border" /></div>
          <Button block variant="outline" size="lg"><Globe />المتابعة عبر Google</Button>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">ليس لديك حساب؟ <a className="font-semibold text-primary" href="#">أنشئ حساباً</a></p>
      </div>
    </div>
  );
}

/* ---------------------------- Settings ---------------------------- */
export function SettingsScreen() {
  const { theme, setTheme, mode, setMode } = useTheme();
  return (
    <div className="animate-rise space-y-6">
      <PageHeader title="الثيمات والإعدادات" subtitle="Claude يختار ثيماً واحداً حسب طبيعة التطبيق" />
      <section>
        <SectionTitle title="الثيم" />
        <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => (
            <button key={t.id} data-theme={t.id} onClick={() => { setTheme(t.id); setMode(t.defaultDark ? "dark" : "light"); }}
              className={cn("relative rounded-xl border-2 bg-background p-4 text-start text-foreground transition-all", theme === t.id ? "border-primary shadow-card" : "border-border hover:border-primary/50")}>
              <div className="mb-3 flex gap-1.5">
                {["bg-primary", "bg-accent", "bg-secondary", "bg-muted"].map((b) => <span key={b} className={cn("size-6 rounded-full border border-border", b)} />)}
              </div>
              <div className="font-display font-bold">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.hint}</div>
              {theme === t.id && <span className="absolute top-3 end-3 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" /></span>}
            </button>
          ))}
        </div>
      </section>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ListGroup title="المظهر">
          <ListRow leading={<Sun className="size-5 text-muted-foreground" />} title="فاتح" chevron={false} onClick={() => setMode("light")} trailing={mode === "light" && <Check className="size-5 text-primary" />} />
          <ListRow leading={<Moon className="size-5 text-muted-foreground" />} title="داكن" chevron={false} onClick={() => setMode("dark")} trailing={mode === "dark" && <Check className="size-5 text-primary" />} />
        </ListGroup>
        <ListGroup title="الحساب">
          <ListRow leading={<Bell className="size-5 text-muted-foreground" />} title="الإشعارات" subtitle="التذكيرات والتنبيهات" />
          <ListRow leading={<Shield className="size-5 text-muted-foreground" />} title="الخصوصية والأمان" />
          <ListRow leading={<Palette className="size-5 text-muted-foreground" />} title="اللغة" trailing={<span className="text-sm text-muted-foreground">العربية</span>} />
          <ListRow leading={<LogOut className="size-5 text-destructive" />} title="تسجيل الخروج" chevron={false} />
        </ListGroup>
      </div>
    </div>
  );
}

/* ----------------------------- Devices ----------------------------- */
const DEVICES = [
  { id: "phone", label: "هاتف", icon: Smartphone, w: 390, h: 844 },
  { id: "tablet", label: "تابلت", icon: Tablet, w: 820, h: 1180 },
  { id: "desktop", label: "كمبيوتر", icon: Monitor, w: 1280, h: 800 },
] as const;

export function DevicesScreen() {
  const { theme, mode } = useTheme();
  const [dev, setDev] = useState<(typeof DEVICES)[number]["id"]>("tablet");
  const d = DEVICES.find((x) => x.id === dev)!;
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / d.w, (window.innerHeight * 0.68) / d.h)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [d]);
  const src = `${location.pathname}${location.search ? location.search + "&" : "?"}embed=1#home`;
  return (
    <div className="animate-rise">
      <PageHeader title="معاينة الأجهزة" subtitle="نفس التطبيق على كل المقاسات — جرّبه من هاتفك" />
      <Tabs value={dev} onValueChange={(v) => setDev(v as typeof dev)}>
        <TabsList className="mb-5 w-full sm:w-auto">
          {DEVICES.map((x) => <TabsTrigger key={x.id} value={x.id}><x.icon className="size-4" />{x.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div ref={box} className="w-full">
        <div className="mx-auto overflow-hidden rounded-[1.75rem] border-[6px] border-foreground/85 bg-background shadow-2xl" style={{ width: d.w * scale + 12, height: d.h * scale + 12 }}>
          <iframe key={dev + theme + mode} title={d.label} src={src} style={{ width: d.w, height: d.h, transform: `scale(${scale})`, transformOrigin: "top right", border: 0 }} />
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground tabular">{d.w}×{d.h}</p>
      </div>
    </div>
  );
}
