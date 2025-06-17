const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const showdown = require("showdown");

const app = express();
const converter = new showdown.Converter();

// تهيئة EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// تهيئة multer لرفع الملفات
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/images/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// فلترة الملفات
const fileFilter = (req, file, cb) => {
  // السماح فقط بملفات الصور
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("يرجى رفع ملفات الصور فقط!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 ميجابايت كحد أقصى
  },
});

// Middleware
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// إنشاء مجلد المقالات إذا لم يكن موجودًا
if (!fs.existsSync("articles")) {
  fs.mkdirSync("articles");
}

// وظيفة مساعدة لقراءة المقالات
async function getArticles() {
  const files = await fs.readdir("articles");
  const articles = await Promise.all(
    files.map(async (file) => {
      const content = await fs.readFile(path.join("articles", file), "utf8");
      const metadata = content.match(/^---\n([\s\S]*?)\n---/);
      const body = content.replace(/^---\n[\s\S]*?\n---/, "").trim();

      let meta = {};
      if (metadata) {
        metadata[1].split("\n").forEach((line) => {
          const [key, ...value] = line.split(":");
          if (key && value) {
            meta[key.trim()] = value.join(":").trim();
          }
        });
      }

      return {
        id: file.replace(".md", ""),
        title: meta.title || "بدون عنوان",
        image: meta.image || "",
        createdAt: meta.createdAt || "",
        updatedAt: meta.updatedAt || "",
        excerpt: body.substring(0, 150) + "...",
        body: converter.makeHtml(body),
      };
    })
  );

  return articles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Routes
app.get("/", (req, res) => {
  res.render("index", {
    title: "الصفحة الرئيسية",
  });
});

app.get("/posts", async (req, res) => {
  try {
    const articles = await getArticles();
    res.render("posts", {
      title: "المقالات",
      articles,
      isListPage: true,
    });
  } catch (err) {
    res.status(500).render("error", { error: err.message });
  }
});

app.get("/editor", (req, res) => {
  res.render("editor", { title: "مقال جديد", isEditor: true });
});

app.get("/editor/:id", async (req, res) => {
  try {
    const filePath = path.join("articles", `${req.params.id}.md`);
    const content = await fs.readFile(filePath, "utf8");
    const metadata = content.match(/^---\n([\s\S]*?)\n---/);
    const body = content.replace(/^---\n[\s\S]*?\n---/, "").trim();

    let meta = {};
    if (metadata) {
      metadata[1].split("\n").forEach((line) => {
        const [key, ...value] = line.split(":");
        if (key && value) {
          meta[key.trim()] = value.join(":").trim();
        }
      });
    }

    res.render("editor", {
      title: "تعديل المقال",
      article: {
        id: req.params.id,
        title: meta.title,
        image: meta.image,
        body: body,
      },
      isEditor: true,
    });
  } catch (err) {
    res.status(404).render("error", { error: "المقال غير موجود" });
  }
});

app.get("/post/:id", async (req, res) => {
  try {
    const filePath = path.join("articles", `${req.params.id}.md`);
    const content = await fs.readFile(filePath, "utf8");
    const metadata = content.match(/^---\n([\s\S]*?)\n---/);
    const body = content.replace(/^---\n[\s\S]*?\n---/, "").trim();

    let meta = {};
    if (metadata) {
      metadata[1].split("\n").forEach((line) => {
        const [key, ...value] = line.split(":");
        if (key && value) {
          meta[key.trim()] = value.join(":").trim();
        }
      });
    }

    const articles = await getArticles();

    res.render("post-detail", {
      title: meta.title || "بدون عنوان",
      article: {
        id: req.params.id,
        title: meta.title || "بدون عنوان",
        image: meta.image || "",
        createdAt: meta.createdAt || "",
        updatedAt: meta.updatedAt || "",
        body: converter.makeHtml(body),
      },
      articles,
    });
  } catch (err) {
    res.status(404).render("error", { error: "المقال غير موجود" });
  }
});

app.post("/save-article", upload.single("image"), async (req, res) => {
  try {
    const { title, body, articleId } = req.body;
    const id = articleId || uuidv4();
    const now = new Date().toISOString();
    const imagePath = req.file
      ? `/images/${req.file.filename}`
      : req.body.existingImage || "";

    const content = `---
title: ${title}
image: ${imagePath}
createdAt: ${now}
updatedAt: ${now}
---\n\n${body}`;

    await fs.writeFile(path.join("articles", `${id}.md`), content);
    res.redirect(`/post/${id}`);
  } catch (err) {
    res.status(500).render("error", { error: err.message });
  }
});

app.post("/delete-article/:id", async (req, res) => {
  try {
    await fs.unlink(path.join("articles", `${req.params.id}.md`));
    res.redirect("/posts");
  } catch (err) {
    res.status(500).render("error", { error: err.message });
  }
});

// معالجة الأخطاء
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", {
    title: "خطأ",
    message: "حدث خطأ في الخادم",
  });
});

// تحديد المنفذ
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.clear(); // مسح الشاشة
  console.log('\x1b[36m%s\x1b[0m', '===================================');
  console.log('\x1b[32m%s\x1b[0m', '🚀 تم تشغيل الخادم بنجاح!');
  console.log('\x1b[36m%s\x1b[0m', '===================================');
  console.log('\x1b[33m%s\x1b[0m', '📍 يمكنك الوصول للموقع من خلال:');
  console.log('\x1b[94m%s\x1b[0m', `http://localhost:${port}`);
  console.log('\x1b[36m%s\x1b[0m', '===================================');
});
