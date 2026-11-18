# Forge — مصنع التطبيقات الشخصي

إضافة (Plugin) لـ Claude Code تبني تطبيقات ومواقع ومنظومات وألعاباً احترافية بالعربية من برومبت واحد.

## التثبيت (مرة واحدة على كل جهاز)

```
/plugin marketplace add ameenalqmaty-cmd/forge
/plugin install forge@forge
```

وللتحديث بعد أي إضافة جديدة: `/plugin marketplace update forge`

## الاستعمال

1. أنشئ مستودعاً فارغاً للتطبيق على GitHub، وافتح فيه جلسة Claude Code (من الهاتف أو الكمبيوتر).
2. اكتب فكرتك: «ابنِ لي تطبيق…». يكتب Claude مواصفة قصيرة، ثم يبني ويفحص ويرفع.
3. مع كل رفع، يحدث تلقائياً:
   - فحص بصري على الهاتف والتابلت والكمبيوتر
   - نشر الموقع على Cloudflare
   - ملف APK جاهز في صفحة Releases

## المحتوى

| المسار | ما هو |
|---|---|
| `plugin/skills/new-app/` | بناء تطبيق جديد، ويتضمن القالب `template/` |
| `plugin/skills/publish-app/` | النشر، وAPK، والنطاق الخاص، وGoogle Play |
| `plugin/skills/forge-extend/` | إضافة ثيمات وواجهات وقدرات جديدة إلى Forge نفسه |
| `plugin/skills/new-app/template/` | القالب: ٥ ثيمات، وغلاف متجاوب، ومكوّنات، وفحص بصري، وأيقونات، وCapacitor، وGitHub Actions |

## إضافة قدرات جديدة

اطلب من Claude داخل هذا المستودع: «أضف لـ forge…» (ثيم، أو مكوّن، أو نوع قالب، أو Skill جديدة). يضيفها ويفحصها ويرفعها، ثم حدّث الإضافة على أجهزتك.
