// บันทึกการอัปเดตที่ผู้ใช้เห็นใน "มีอะไรใหม่" — เพิ่มรายการใหม่ไว้บนสุด (id ต้องไม่ซ้ำ ใช้บอกว่าผู้ใช้เห็นแล้วหรือยัง)
// เขียนเฉพาะสิ่งที่ผู้ใช้สังเกตเห็นได้ ไม่ต้องใส่งานหลังบ้าน

export interface ChangelogText {
  th: string
  en: string
}

export interface ChangelogEntry {
  id: string
  /** YYYY-MM-DD */
  date: string
  title: ChangelogText
  items: ChangelogText[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-10-12-fur-filter',
    date: '2026-10-12',
    title: { th: 'กรองสีขนได้หลายสี', en: 'Filter by several fur colors' },
    items: [
      {
        th: 'ตัวกรอง "สีขน" บนแผนที่เลือกได้หลายสีพร้อมกัน เช่น ส้ม + ส้มขาว + ลายสลิด',
        en: 'The "Fur color" filter on the map now takes several colors at once, e.g. orange + orange & white + tabby',
      },
    ],
  },
  {
    id: '2026-10-12-pins',
    date: '2026-10-12',
    title: { th: 'ย้ายหมุดได้ และป้ายแดงน่าเชื่อถือขึ้น', en: 'Move pins, and more trustworthy help reports' },
    items: [
      { th: 'คนปักหมุดย้ายตำแหน่งหมุดได้แล้ว ที่ แก้ไขหมุด → ย้ายตำแหน่งหมุด', en: 'Pinners can now move their pins: Edit pin → Move pin' },
      {
        th: 'เจอหมุดที่อยู่ผิดที่? กด "หมุดอยู่ผิดที่?" ในหน้าน้อง แล้วส่งตำแหน่งที่ถูกให้คนปักหมุดตัดสินใจได้',
        en: 'Pin in the wrong spot? Tap "Wrong spot?" on the cat page to suggest the right place to the pinner',
      },
      { th: 'หมุดอยู่ตรงจุดที่ปักพอดี ไม่ถูกขยับสุ่มแล้ว', en: 'Pins now stay exactly where you place them' },
      {
        th: 'ป้ายบนรูปบอกว่าถ่ายรูปที่นี่จริง หรือมีคนเจอน้องล่าสุดเมื่อไหร่',
        en: 'The photo badge now shows whether the photo was taken on the spot, or when the cat was last seen',
      },
      {
        th: 'แจ้งว่าน้องต้องการความช่วยเหลือ: มีป้าย "แจ้งจากจุดที่เจอน้อง" ปุ่ม "ฉันก็เห็น" และเรื่องที่ค้างนานจะปิดเอง',
        en: 'Help reports: "Reported on the spot" badge, an "I saw it too" button, and stale reports close by themselves',
      },
      { th: 'หน้าต่างยืนยันเป็นแบบของแอปเอง และแก้หน้าต่างที่เลื่อนไม่ได้บนมือถือ', en: 'In-app confirmation windows, and fixed windows that would not scroll on phones' },
    ],
  },
  {
    id: '2026-10-12-community',
    date: '2026-10-12',
    title: { th: 'ชุมชนคนรักแมว', en: 'A community for cat lovers' },
    items: [
      { th: 'แจ้งเตือนเด้งบนมือถือ (เปิดได้ที่ การแจ้งเตือน)', en: 'Push notifications on your phone (turn on in Notifications)' },
      { th: 'ค้นหาน้องด้วยรูป — ถ่ายรูปแมวแล้วดูว่าเคยมีคนปักหมุดไว้ไหม', en: 'Search by photo: snap a cat and see if it has been pinned' },
      { th: 'กดถูกใจ ตอบกลับ และรายงานรีวิวที่ไม่เหมาะสม', en: 'Like, reply to and report reviews' },
      { th: '"แมวใกล้ฉัน" และเปิดแอปมาที่ตำแหน่งของคุณ', en: '"Cats near me", and the map opens where you are' },
      { th: 'ติดตามน้อง รู้ทันทีเมื่อมีรีวิวใหม่หรือมีคนแจ้งว่าน้องต้องการความช่วยเหลือ', en: 'Follow cats to hear about new reviews and help requests' },
      { th: 'แจ้งว่าน้องต้องการความช่วยเหลือ (บาดเจ็บ ป่วย ผอม ยังไม่ทำหมัน)', en: 'Flag cats that need help (injured, sick, thin, not neutered)' },
      { th: 'บันทึกการให้อาหาร กันน้องได้อาหารเยอะเกิน', en: "Log feedings so cats don't get overfed" },
      { th: 'เหรียญตราและอันดับนักตามหาแมวในพื้นที่', en: 'Badges and an area leaderboard' },
      { th: 'ประกาศแมวหายและหาบ้านให้น้อง', en: 'Lost cat and adoption board' },
      { th: 'ช่วงเวลาที่มักเจอน้อง', en: 'When a cat is usually seen' },
      { th: 'ลิงก์แชร์มีรูปน้องใน LINE และ Facebook', en: 'Share links show the cat in LINE and Facebook' },
      { th: 'เตือนก่อนปักหมุดซ้ำ "ใช่น้องตัวนี้ไหม?"', en: '"Is it one of these cats?" before adding a duplicate pin' },
      { th: 'คนปักหมุดแก้ไขและลบหมุดของตัวเองได้', en: 'Pinners can edit and delete their pins' },
      { th: 'ติดตั้ง MeowPin เป็นแอปบนมือถือได้', en: 'Install MeowPin as an app on your phone' },
    ],
  },
  {
    id: '2026-10-11-launch',
    date: '2026-10-11',
    title: { th: 'เปิดตัว MeowPin 🐾', en: 'MeowPin launches 🐾' },
    items: [
      { th: 'ปักหมุดน้องแมวที่เจอ พร้อมรูปและตำแหน่งจาก GPS', en: 'Pin the cats you meet, with a photo and GPS location' },
      { th: 'รีวิวให้คะแนนเป็นอุ้งเท้า พร้อมแนบรูป และอัลบั้มรูปของน้อง', en: 'Paw-rating reviews with photos, and a photo album for each cat' },
      { th: 'AI สรุปรีวิวของน้อง และตรวจว่ารูปเป็นแมวจริง', en: 'AI review summaries and a cat photo check' },
      { th: 'สีขนและสายพันธุ์ กำหนดสีเองได้', en: 'Fur colors and breeds, including custom colors' },
      { th: 'ธีมมืด ภาษาอังกฤษ และแปลข้อความของผู้ใช้', en: 'Dark mode, English, and translation of user posts' },
    ],
  },
]

export const LATEST_CHANGELOG_ID = CHANGELOG[0].id
