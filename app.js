const express = require('express');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const flash = require('connect-flash');
const moment = require('moment');
const multer = require('multer');
const sharp = require('sharp');

const app = express();

// إنشاء المجلدات اللازمة إذا لم تكن موجودة
const createRequiredDirectories = () => {
  const directories = [
    path.join(__dirname, 'public', 'images', 'team-logos'),
    path.join(__dirname, 'public', 'profile-pictures'),
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`تم إنشاء المجلد: ${dir}`);
    }
  });
};

createRequiredDirectories();

// إعداد اتصال قاعدة البيانات
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'football_tickets'
});

db.connect((err) => {
  if (err) {
    console.error('خطأ في الاتصال بقاعدة البيانات:', err);
    return;
  }
  console.log('تم الاتصال بقاعدة البيانات بنجاح');
});

// إعداد المحرك لعرض الصفحات
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// استخدام الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// إعداد الجلسات والرسائل الفلاشية
const sessionStore = new MySQLStore({
  expiration: 86400000,
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, db);

app.use(session({
  key: 'session_cookie_name',
  secret: 'session_cookie_secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

// إعداد multer لتحميل الصور للمستخدمين
const storageUser = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = path.join(__dirname, 'public', 'profile-pictures');
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const uploadUser = multer({ storage: storageUser });

// إعداد multer لتحميل شعارات الفرق
const storageTeamLogo = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = path.join(__dirname, 'public', 'images', 'team-logos');
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const uploadTeamLogo = multer({ storage: storageTeamLogo });

// ميدلوير للتحقق من تسجيل الدخول
const isLoggedIn = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    req.flash('error', 'يرجى تسجيل الدخول أولاً');
    res.redirect('/login');
  }
};

// ميدلوير للتحقق من صلاحيات الأدمن
const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.is_admin) {
    next();
  } else {
    req.flash('error', 'غير مصرح لك بالوصول إلى لوحة التحكم');
    res.redirect('/');
  }
};

// ميدلوير للتحقق من صلاحيات مدير النادي
const isClubManager = (req, res, next) => {
  if (req.session.user && req.session.user.is_club_manager) {
    next();
  } else {
    req.flash('error', 'يجب تسجيل الدخول كمدير نادي للوصول إلى هذه الصفحة');
    res.redirect('/login');
  }
};

// دالة مساعدة: الاستعلام عن قاعدة البيانات
function queryDatabase(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// دالة لتنفيذ المعاملات
async function executeTransaction(queries) {
  return new Promise((resolve, reject) => {
    db.beginTransaction(async (err) => {
      if (err) {
        return reject(err);
      }

      try {
        for (const query of queries) {
          await new Promise((resolveQuery, rejectQuery) => {
            db.query(query.sql, query.params, (err, result) => {
              if (err) rejectQuery(err);
              else resolveQuery(result);
            });
          });
        }

        db.commit((err) => {
          if (err) {
            return db.rollback(() => {
              reject(err);
            });
          }
          resolve();
        });
      } catch (error) {
        return db.rollback(() => {
          reject(error);
        });
      }
    });
  });
}

// دالة لتوليد كود عشوائي
function generateRandomCode(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// ميدلوير عام لتعيين متغيرات الجلسة في res.locals
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isLoggedIn = !!req.session.user;
  res.locals.isAdmin = req.session.user ? req.session.user.is_admin : false;
  next();
});

// الصفحة الرئيسية
app.get('/', async (req, res) => {
  try {
    const matches = await queryDatabase('SELECT * FROM matches WHERE date >= CURDATE() ORDER BY date, time LIMIT 5');
    res.render('index', { 
      matches,
      messages: req.flash()
    });
  } catch (error) {
    console.error('خطأ في جلب المباريات:', error);
    res.render('index', { 
      matches: [],
      messages: { error: 'حدث خطأ أثناء جلب المباريات' }
    });
  }
});

// صفحة تسجيل الدخول
app.get('/login', (req, res) => {
  res.render('login', { 
    messages: req.flash()
  });
});

// صفحة التسجيل
app.get('/register', (req, res) => {
  res.render('register', { 
    messages: req.flash()
  });
});

// صفحة المباريات
app.get('/matches', isLoggedIn, async (req, res) => {
  try {
    const matches = await queryDatabase('SELECT * FROM matches');
    res.render('matches', { 
      matches, 
      messages: req.flash()
    });
  } catch (error) {
    console.error('خطأ في استعلام المباريات:', error);
    req.flash('error', 'حدث خطأ أثناء جلب المباريات');
    res.redirect('/');
  }
});

// صفحة لوحة التحكم
app.get('/admin', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const matches = await queryDatabase('SELECT * FROM matches');
    const users = await queryDatabase('SELECT id, username, email, balance, created_at FROM users WHERE is_admin = 0');
    const activeUsers = await queryDatabase('SELECT COUNT(DISTINCT user_id) as count FROM sessions WHERE expires > NOW()');
    const visitors = await queryDatabase('SELECT COUNT(*) as count FROM visitors');
    const rechargeCodes = await queryDatabase('SELECT * FROM recharge_codes ORDER BY created_at DESC LIMIT 50');

    res.render('admin', { 
      matches: matches,
      users: users,
      activeUsers: activeUsers[0].count,
      visitors: visitors[0].count,
      rechargeCodes: rechargeCodes,
      messages: req.flash()
    });
  } catch (error) {
    console.error('خطأ في لوحة التحكم:', error);
    req.flash('error', 'حدث خطأ أثناء تحميل لوحة التحكم');
    res.redirect('/');
  }
});

// إضافة مباراة جديدة
app.post('/admin/add-match', isLoggedIn, isAdmin, [
  body('team1').notEmpty().withMessage('اسم الفريق الأول مطلوب'),
  body('team2').notEmpty().withMessage('اسم الفريق الثاني مطلوب'),
  body('date').notEmpty().withMessage('تاريخ المباراة مطلوب'),
  body('time').notEmpty().withMessage('وقت المباراة مطلوب'),
  body('stadium').notEmpty().withMessage(' الملعب مطلوب'),
  body('price').isNumeric().withMessage('السعر يجب أن يكون رقمًا'),
  body('vip_price').isNumeric().withMessage('سعر VIP يجب أن يكون رقمًا'),
  body('regular_tickets').isInt({ min: 0 }).withMessage('عدد التذاكر العادية يجب أن يكون رقمًا صحيحًا موجبًا'),
  body('vip_tickets').isInt({ min: 0 }).withMessage('عدد تذاكر VIP يجب أن يكون رقمًا صحيحًا موجبًا')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map(err => err.msg));
    return res.redirect('/admin');
  }

  const { team1, team2, date, time, stadium,price, vip_price, regular_tickets, vip_tickets } = req.body;
  try {
    await queryDatabase('INSERT INTO matches (team1, team2, date, time, stadium,price, vip_price, regular_tickets, vip_tickets) VALUES (?, ?, ?, ?, ?, ?, ?, ?,?)', 
      [team1, team2, date, time, stadium,price, vip_price, regular_tickets, vip_tickets]);
    req.flash('success', 'تمت إضافة المباراة بنجاح');
  } catch (error) {
    console.error('خطأ في إضافة المباراة:', error);
    req.flash('error', 'حدث خطأ أثناء إضافة المباراة');
  }
  res.redirect('/admin');
});

// حذف مباراة
app.post('/admin/delete-match/:id', isLoggedIn, isAdmin, async (req, res) => {
  const matchId = req.params.id;
  try {
    await executeTransaction([
      { sql: 'DELETE FROM tickets WHERE match_id = ?', params: [matchId] },
      { sql: 'DELETE FROM matches WHERE id = ?', params: [matchId] }
    ]);
    req.flash('success', 'تم حذف المباراة والتذاكر المرتبطة بها بنجاح');
  } catch (error) {
    console.error('خطأ في حذف المباراة:', error);
    req.flash('error', 'حدث خطأ أثناء حذف المباراة');
  }
  res.redirect('/admin');
});

// تسجيل الدخول
app.post('/login', [
  body('username').notEmpty().withMessage('اسم المستخدم مطلوب'),
  body('password').notEmpty().withMessage('كلمة المرور مطلوبة')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map(err => err.msg));
    return res.redirect('/login');
  }

  const { username, password } = req.body;
  try {
    const users = await queryDatabase('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length > 0) {
      const match = await bcrypt.compare(password, users[0].password);
      if (match) {
        req.session.user = {
          id: users[0].id,
          username: users[0].username,
          email: users[0].email,
          is_admin: users[0].is_admin === 1,
          is_club_manager: false,
          profile_picture: users[0].profile_picture || '/images/default-avatar.png'
        };
        req.flash('success', 'تم تسجيل الدخول بنجاح');
        return res.redirect('/');
      }
    }
    req.flash('error', 'اسم المستخدم أو كلمة المرور غير صحيحة');
    res.redirect('/login');
  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    req.flash('error', 'حدث خطأ أثناء تسجيل الدخول');
    res.redirect('/login');
  }
});

// التسجيل
app.post('/register', uploadUser.single('profile_picture'), [
  body('username').notEmpty().withMessage('اسم المستخدم مطلوب'),
  body('email').isEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون على الأقل 6 أحرف')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map(err => err.msg));
    return res.redirect('/register');
  }

  const { username, email, password } = req.body;
  const defaultProfilePicture = '/images/default-avatar.png';
  const profilePicture = req.file ? '/profile-pictures/' + req.file.filename : defaultProfilePicture;

  try {
    const existingUsers = await queryDatabase('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUsers.length > 0) {
      req.flash('error', 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل');
      return res.redirect('/register');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await queryDatabase('INSERT INTO users (username, email, password, is_admin, profile_picture, created_at) VALUES (?, ?, ?, ?, ?, NOW())', 
      [username, email, hashedPassword, 0, profilePicture]);
    
    req.flash('success', 'تم التسجيل بنجاح. يمكنك الآن تسجيل الدخول.');
    res.redirect('/login');
  } catch (error) {
    console.error('خطأ في التسجيل:', error);
    req.flash('error', 'حدث خطأ أثناء التسجيل');
    res.redirect('/register');
  }
});

// تسجيل الخروج
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('خطأ في تسجيل الخروج:', err);
    }
    res.redirect('/');
  });
});

// صفحة الملف الشخصي
app.get('/profile', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await queryDatabase('SELECT * FROM users WHERE id = ?', [userId]);
    const tickets = await queryDatabase('SELECT t.id, m.team1, m.team2, m.date, m.time FROM tickets t JOIN matches m ON t.match_id = m.id WHERE t.user_id = ?', [userId]);
    const transactions = await queryDatabase('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', [userId]);
    
    if (user.length === 0) {
      req.flash('error', 'المستخدم غير موجود');
      return res.redirect('/');
    }
    
    res.render('profile', { 
      user: user[0],
      tickets: tickets,
      transactions: transactions,
      messages: req.flash()
    });
  } catch (error) {
    console.error('خطأ في جلب بيانات المستخدم:', error);
    req.flash('error', 'حدث خطأ أثناء جلب بيانات الملف الشخصي');
    res.redirect('/');
  }
});

// تحديث المعلومات الشخصية
app.post('/update-personal-info', isLoggedIn, [
  body('username').notEmpty().withMessage('اسم المستخدم مطلوب'),
  body('email').isEmail().withMessage('البريد الإلكتروني غير صالح')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { username, email } = req.body;
  const userId = req.session.user.id;

  try {
    await queryDatabase('UPDATE users SET username = ?, email = ? WHERE id = ?', [username, email, userId]);
    res.json({ success: true, message: 'تم تحديث المعلومات الشخصية بنجاح' });
  } catch (error) {
    console.error('خطأ في تحديث المعلومات الشخصية:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء تحديث المعلومات الشخصية' });
  }
});

// تغيير كلمة المرور
app.post('/change-password', isLoggedIn, [
  body('currentPassword').notEmpty().withMessage('كلمة المرور الحالية مطلوبة'),
  body('newPassword').isLength({ min: 6 }).withMessage('كلمة المرور الجديدة يجب أن تكون على الأقل 6 أحرف'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('كلمات المرور غير متطابقة');
    }
    return true;
  })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map(err => err.msg));
    return res.redirect('/profile');
  }

  const { currentPassword, newPassword } = req.body;
  const userId = req.session.user.id;

  try {
    const user = await queryDatabase('SELECT password FROM users WHERE id = ?', [userId]);
    const match = await bcrypt.compare(currentPassword, user[0].password);
    if (!match) {
      req.flash('error', 'كلمة المرور الحالية غير صحيحة');
      return res.redirect('/profile');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await queryDatabase('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);
    
    req.flash('success', 'تم تغيير كلمة المرور بنجاح');
    res.redirect('/profile');
  } catch (error) {
    console.error('خطأ في تغيير كلمة المرور:', error);
    req.flash('error', 'حدث خطأ أثناء تغيير كلمة المرور');
    res.redirect('/profile');
  }
});

// تحديث الصورة الشخصية
app.post('/change-profile-picture', isLoggedIn, uploadUser.single('profilePicture'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'لم يتم تحميل أي صورة' });
  }

  try {
    const userId = req.session.user.id;
    const imagePath = '/profile-pictures/' + req.file.filename;
    
    // معالجة الصورة وحفظها
    await sharp(req.file.path)
      .resize(200, 200)
      .toFile(path.join(__dirname, 'public', imagePath));

    await queryDatabase('UPDATE users SET profile_picture = ? WHERE id = ?', [imagePath, userId]);
    
    res.json({ success: true, message: 'تم تحديث الصورة الشخصية بنجاح', newAvatarUrl: imagePath });
  } catch (error) {
    console.error('خطأ في تحديث الصورة الشخصية:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء تحديث الصورة الشخصية' });
  }
});

// طباعة التذكرة
app.get('/print-ticket/:id', isLoggedIn, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const ticket = await queryDatabase('SELECT t.*, m.team1, m.team2, m.date, m.time FROM tickets t JOIN matches m ON t.match_id = m.id WHERE t.id = ? AND t.user_id = ?', [ticketId, req.session.user.id]);
    
    if (ticket.length === 0) {
      return res.status(404).json({ success: false, message: 'التذكرة غير موجودة' });
    }
    
    res.render('print-ticket', { ticket: ticket[0] });
  } catch (error) {
    console.error('خطأ في طباعة التذكرة:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء طباعة التذكرة' });
  }
});

// صفحة شحن المحفظة
app.get('/recharge-wallet', isLoggedIn, async (req, res) => {
  try {
    const user = await queryDatabase('SELECT balance FROM users WHERE id = ?', [req.session.user.id]);
    res.render('recharge-wallet', { 
      messages: req.flash(),
      walletBalance: user[0].balance
    });
  } catch (error) {
    console.error('خطأ في جلب رصيد المحفظة:', error);
    req.flash('error', 'حدث خطأ أثناء جلب رصيد المحفظة');
    res.redirect('/');
  }
});

// استخدام كود الشحن
app.post('/use-recharge-code', isLoggedIn, async (req, res) => {
  const { code } = req.body;
  const userId = req.session.user.id;

  try {
    const rechargeCode = await queryDatabase('SELECT * FROM recharge_codes WHERE code = ? AND is_used = 0', [code]);
    
    if (rechargeCode.length === 0) {
      req.flash('error', 'كود الشحن غير صالح أو تم استخدامه بالفعل');
      return res.redirect('/recharge-wallet');
    }

    await executeTransaction([
      { sql: 'UPDATE users SET balance = balance + ? WHERE id = ?', params: [rechargeCode[0].amount, userId] },
      { sql: 'UPDATE recharge_codes SET is_used = 1, used_by = ?, used_at = NOW() WHERE id = ?', params: [userId, rechargeCode[0].id] },
      { sql: 'INSERT INTO transactions (user_id, amount, type, description, created_at) VALUES (?, ?, ?, ?, NOW())', 
        params: [userId, rechargeCode[0].amount, 'credit', 'شحن المحفظة باستخدام كود'] }
    ]);

    req.flash('success', `تم شحن رصيدك بنجاح بمبلغ ${rechargeCode[0].amount} ريال`);
    res.redirect('/recharge-wallet');
  } catch (error) {
    console.error('خطأ في استخدام كود الشحن:', error);
    req.flash('error', 'حدث خطأ أثناء استخدام كود الشحن');
    res.redirect('/recharge-wallet');
  }
});

// صفحة تفاصيل المباراة وحجز التذاكر
app.get('/match-details/:id', isLoggedIn, async (req, res) => {
  try {
    const matchId = req.params.id;
    const match = await queryDatabase('SELECT * FROM matches WHERE id = ?', [matchId]);
    
    if (match.length === 0) {
      req.flash('error', 'المباراة غير موجودة');
      return res.redirect('/matches');
    }

    res.render('match-details', { 
      match: match[0],
      messages: req.flash()
    });
  } catch (error) {
    console.error('خطأ في جلب تفاصيل المباراة:', error);
    req.flash('error', 'حدث خطأ أثناء جلب تفاصيل المباراة');
    res.redirect('/matches');
  }
});

// حجز التذاكر
app.post('/book-tickets/:matchId', isLoggedIn, async (req, res) => {
  try {
    const matchId = req.params.matchId;
    const { ticketType, quantity } = req.body;
    const match = await queryDatabase('SELECT * FROM matches WHERE id = ?', [matchId]);
    
    if (match.length === 0) {
      req.flash('error', 'المباراة غير موجودة');
      return res.redirect('/matches');
    }

    const price = ticketType === 'vip' ? match[0].vip_price : match[0].price;
    const totalPrice = price * quantity;

    const user = await queryDatabase('SELECT balance FROM users WHERE id = ?', [req.session.user.id]);
    
    if (user[0].balance < totalPrice) {
      req.flash('error', 'رصيد المحفظة غير كافٍ لحجز التذاكر');
      return res.redirect(`/match-details/${matchId}`);
    }

    const availableTickets = ticketType === 'vip' ? match[0].vip_tickets : match[0].regular_tickets;
    if (availableTickets < quantity) {
      req.flash('error', 'عدد التذاكر المطلوبة غير متوفر');
      return res.redirect(`/match-details/${matchId}`);
    }

    await executeTransaction([
      { sql: 'UPDATE users SET balance = balance - ? WHERE id = ?', params: [totalPrice, req.session.user.id] },
      { sql: 'INSERT INTO tickets (user_id, match_id, ticket_type, quantity) VALUES (?, ?, ?, ?)', params: [req.session.user.id, matchId, ticketType, quantity] },
      { 
        sql: ticketType === 'vip' ? 'UPDATE matches SET vip_tickets = vip_tickets - ? WHERE id = ?' : 'UPDATE matches SET regular_tickets = regular_tickets - ? WHERE id = ?',
        params: [quantity, matchId]
      },
      { sql: 'INSERT INTO transactions (user_id, amount, type, description, created_at) VALUES (?, ?, ?, ?, NOW())', 
        params: [req.session.user.id, -totalPrice, 'debit', `حجز ${quantity} تذكرة للمباراة ${match[0].team1} ضد ${match[0].team2}`] }
    ]);

    req.flash('success', `تم حجز ${quantity} تذكرة بنجاح`);
    res.redirect(`/match-details/${matchId}`);
  } catch (error) {
    console.error('خطأ في حجز التذاكر:', error);
    req.flash('error', 'حدث خطأ أثناء حجز التذاكر');
    res.redirect(`/match-details/${req.params.matchId}`);
  }
});

// صفحة "اعرف المزيد"
app.get('/about', (req, res) => {
  res.render('about', {
    title: 'اعرف المزيد - SYTIX',
    messages: req.flash()
  });
});

// توليد أكواد الشحن
app.post('/admin/generate-recharge-codes', isLoggedIn, isAdmin, [
  body('amount').isNumeric().withMessage('المبلغ يجب أن يكون رقمًا'),
  body('count').isInt({ min: 1 }).withMessage('عدد الأكواد يجب أن يكون رقمًا صحيحًا موجبًا')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map(err => err.msg));
    return res.redirect('/admin');
  }

  const { amount, count } = req.body;
  const codes = [];

  try {
    for (let i = 0; i < count; i++) {
      const code = generateRandomCode();
      codes.push([code, amount]);
    }

    await queryDatabase('INSERT INTO recharge_codes (code, amount) VALUES ?', [codes]);
    req.flash('success', `تم إنشاء ${count} كود شحن بنجاح`);
  } catch (error) {
    console.error('خطأ في إنشاء أكواد الشحن:', error);
    req.flash('error', 'حدث خطأ أثناء إنشاء أكواد الشحن');
  }
  res.redirect('/admin');
});

// صفحة مدير النادي
app.get('/club-manager', (req, res) => {
  res.render('club-manager', { 
    messages: req.flash()
  });
});
app.get('/club-registration', (req, res) => {
  res.render('club-registration', { 
    messages: req.flash()
  });
});
// تسجيل دخول مدير النادي
app.post('/club-manager/login', [
  body('username').notEmpty().withMessage('اسم المستخدم مطلوب'),
  body('password').notEmpty().withMessage('كلمة المرور مطلوبة')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map(err => err.msg));
    return res.redirect('/club-manager');
  }

  const { username, password } = req.body;
  try {
    const managers = await queryDatabase('SELECT * FROM club_managers WHERE username = ?', [username]);
    if (managers.length > 0) {
      const match = await bcrypt.compare(password, managers[0].password);
      if (match) {
        req.session.user = {
          id: managers[0].id,
          username: managers[0].username,
          is_club_manager: true,
          club_name: managers[0].club_name
        };
        req.flash('success', 'تم تسجيل الدخول بنجاح');
        return res.redirect('/club-profile');
      }
    }
    req.flash('error', 'اسم المستخدم أو كلمة المرور غير صحيحة');
    res.redirect('/club-manager');
  } catch (error) {
    console.error('خطأ في تسجيل دخول مدير النادي:', error);
    req.flash('error', 'حدث خطأ أثناء تسجيل الدخول');
    res.redirect('/club-manager');
  }
});

app.post('/club-manager/register', uploadTeamLogo.single('team_logo'), [
  body('username').notEmpty().withMessage('اسم المستخدم مطلوب'),
  body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون على الأقل 6 أحرف'),
  body('club_name').notEmpty().withMessage('اسم النادي مطلوب'),
  body('club_address').notEmpty().withMessage('عنوان النادي مطلوب'),
  body('stadium_address').notEmpty().withMessage('عنوان الملعب مطلوب')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map(err => err.msg));
    return res.redirect('/club-manager');
  }

  const { username, password, club_name, club_address, stadium_address } = req.body;
  const team_logo = req.file ? '/images/team-logos/' + req.file.filename : null;

  try {
    const existingManager = await queryDatabase('SELECT * FROM club_managers WHERE username = ?', [username]);
    if (existingManager.length > 0) {
      req.flash('error', 'اسم المستخدم مستخدم بالفعل');
      return res.redirect('/club-manager');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await queryDatabase('INSERT INTO club_managers (username, password, club_name, club_address, stadium_address, team_logo) VALUES (?, ?, ?, ?, ?, ?)', 
      [username, hashedPassword, club_name, club_address, stadium_address, team_logo]);
    
    req.flash('success', 'تم تسجيل مدير النادي بنجاح. يمكنك الآن تسجيل الدخول.');
    res.redirect('/club-manager');
  } catch (error) {
    console.error('خطأ في تسجيل مدير النادي:', error);
    req.flash('error', 'حدث خطأ أثناء التسجيل');
    res.redirect('/club-manager');
  }
});

// صفحة الملف الشخصي للنادي
app.get('/club-profile', isLoggedIn, isClubManager, async (req, res) => {
  try {
    const manager = await queryDatabase('SELECT * FROM club_managers WHERE id = ?', [req.session.user.id]);
    
    if (!manager || manager.length === 0) {
      req.flash('error', 'لم يتم العثور على بيانات مدير النادي');
      return res.redirect('/');
    }

    const players = await queryDatabase('SELECT * FROM players WHERE club_id = ?', [req.session.user.id]);
    const matches = await queryDatabase('SELECT * FROM matches WHERE team1 = ? OR team2 = ? ORDER BY date ASC', [manager[0].club_name, manager[0].club_name]);

    console.log('Manager:', manager[0]); // للتحقق من البيانات
    console.log('Players:', players);
    console.log('Matches:', matches);

    res.render('club-profile', {
      manager: manager[0],
      players: players,
      matches: matches,
      messages: req.flash()
    });
  } catch (error) {
    console.error('خطأ في جلب بيانات النادي:', error);
    req.flash('error', 'حدث خطأ أثناء جلب بيانات النادي');
    res.redirect('/');
  }
});
// إضافة لاعب جديد
app.post('/add-player', isLoggedIn, isClubManager, (req, res, next) => {
  console.log('بيانات الطلب:', req.body);
  console.log('معرف النادي:', req.session.user.id);
  next();
}, [
  body('name').notEmpty().trim().withMessage('اسم اللاعب مطلوب'),
  body('position').notEmpty().trim().withMessage('مركز اللاعب مطلوب'),
  body('contract_duration').isInt({ min: 1 }).withMessage('مدة العقد يجب أن تكون رقمًا صحيحًا موجبًا')
], (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('أخطاء التحقق:', errors.array());
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}, async (req, res) => {
  try {
    const { name, position, contract_duration } = req.body;
    const clubId = req.session.user.id;

    // اختبار الاتصال بقاعدة البيانات
    const testConnection = await queryDatabase('SELECT 1');
    console.log('اختبار الاتصال بقاعدة البيانات:', testConnection);

    // التحقق من عدم وجود لاعب بنفس الاسم في النادي
    const existingPlayer = await queryDatabase('SELECT id FROM players WHERE club_id = ? AND name = ?', [clubId, name]);
    if (existingPlayer.length > 0) {
      console.log('لاعب موجود بالفعل:', existingPlayer);
      return res.status(400).json({ success: false, message: 'يوجد لاعب بهذا الاسم بالفعل في النادي' });
    }

    // إضافة اللاعب الجديد
    console.log('محاولة إضافة اللاعب:', { clubId, name, position, contract_duration });
    const result = await queryDatabase('INSERT INTO players (club_id, name, position, contract_duration) VALUES (?, ?, ?, ?)', 
      [clubId, name, position, contract_duration]);
    console.log('نتيجة الإدراج:', result);

    if (result.affectedRows === 1) {
      const newPlayer = await queryDatabase('SELECT * FROM players WHERE id = ?', [result.insertId]);
      console.log('اللاعب الجديد:', newPlayer[0]);
      res.json({ 
        success: true, 
        message: 'تمت إضافة اللاعب بنجاح', 
        player: newPlayer[0]
      });
    } else {
      throw new Error('فشل في إضافة اللاعب');
    }
  } catch (error) {
    console.error('خطأ في إضافة اللاعب:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء إضافة اللاعب', error: error.message });
  }
});
// تعديل بيانات اللاعب
app.post('/edit-player/:id', isLoggedIn, isClubManager, [
  body('name').notEmpty().withMessage('اسم اللاعب مطلوب'),
  body('position').notEmpty().withMessage('مركز اللاعب مطلوب'),
  body('contract_duration').isInt({ min: 1 }).withMessage('مدة العقد يجب أن تكون رقمًا صحيحًا موجبًا')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, position, contract_duration } = req.body;
  const playerId = req.params.id;

  try {
    const result = await queryDatabase('UPDATE players SET name = ?, position = ?, contract_duration = ? WHERE id = ? AND club_id = ?', 
      [name, position, contract_duration, playerId, req.session.user.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'اللاعب غير موجود أو غير مصرح لك بتعديله' });
    }
    
    res.json({ success: true, message: 'تم تحديث بيانات اللاعب بنجاح' });
  } catch (error) {
    console.error('خطأ في تعديل بيانات اللاعب:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء تعديل بيانات اللاعب' });
  }
});
// حذف لاعب
app.post('/delete-player/:id', isLoggedIn, isClubManager, async (req, res) => {
  const playerId = req.params.id;
  try {
    const result = await queryDatabase('DELETE FROM players WHERE id = ? AND club_id = ?', [playerId, req.session.user.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'اللاعب غير موجود أو غير مصرح لك بحذفه' });
    }
    
    res.json({ success: true, message: 'تم حذف اللاعب بنجاح' });
  } catch (error) {
    console.error('خطأ في حذف اللاعب:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء حذف اللاعب' });
  }
});


// تحديث معلومات مدير النادي
app.post('/update-club-profile', isLoggedIn, isClubManager, uploadTeamLogo.single('team_logo'), async (req, res) => {
  try {
      const { username, email, club_name, club_address, stadium_address } = req.body;
      const managerId = req.session.user.id;
      
      let updateData = { username, email, club_name, club_address, stadium_address };
      if (req.file) {
          updateData.team_logo = '/images/team-logos/' + req.file.filename;
      }

      await queryDatabase('UPDATE club_managers SET ? WHERE id = ?', [updateData, managerId]);

      res.json({ success: true, message: 'تم تحديث المعلومات بنجاح' });
  } catch (error) {
      console.error('خطأ في تحديث معلومات مدير النادي:', error);
      res.status(500).json({ success: false, message: 'حدث خطأ أثناء تحديث المعلومات' });
  }
});

// تغيير كلمة مرور مدير النادي
app.post('/change-club-password', isLoggedIn, isClubManager, async (req, res) => {
  try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const managerId = req.session.user.id;

      if (newPassword !== confirmPassword) {
          req.flash('error', 'كلمات المرور الجديدة غير متطابقة');
          return res.redirect('/club-profile');
      }

      const manager = await queryDatabase('SELECT password FROM club_managers WHERE id = ?', [managerId]);
      const isMatch = await bcrypt.compare(currentPassword, manager[0].password);

      if (!isMatch) {
          req.flash('error', 'كلمة المرور الحالية غير صحيحة');
          return res.redirect('/club-profile');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await queryDatabase('UPDATE club_managers SET password = ? WHERE id = ?', [hashedPassword, managerId]);

      req.flash('success', 'تم تغيير كلمة المرور بنجاح');
      res.redirect('/club-profile');
  } catch (error) {
      console.error('خطأ في تغيير كلمة مرور مدير النادي:', error);
      req.flash('error', 'حدث خطأ أثناء تغيير كلمة المرور');
      res.redirect('/club-profile');
  }
});

// تشغيل الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`الخادم يعمل على المنفذ ${PORT}`);
});
