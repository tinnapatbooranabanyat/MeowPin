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
    id: '2026-10-13-missions-button',
    date: '2026-10-13',
    title: { th: 'ภารกิจอยู่บนแผนที่แล้ว', en: 'Missions on the map' },
    items: [
      { th: 'ปุ่ม "ภารกิจ" บนแผนที่ บอกว่าทำไปแล้วกี่ภารกิจ ทำสำเร็จแล้วมีข้อความเด้งบอกทันที', en: 'A "Missions" button on the map shows your progress, and you get a pop-up when you finish one' },
      { th: 'เมนูบัญชีสั้นลง: แก้ไขโปรไฟล์และอุปกรณ์ที่เข้าสู่ระบบย้ายไปอยู่ในหน้าโปรไฟล์', en: 'Shorter account menu: edit profile and signed-in devices now live on your profile page' },
      { th: 'หน้ารูปของน้องมีพื้นหลังโปร่งแสง เห็นแผนที่ด้านหลัง', en: 'The cat photo viewer now has a see-through background' },
    ],
  },
  {
    id: '2026-10-13-missions',
    date: '2026-10-13',
    title: { th: 'ภารกิจประจำสัปดาห์', en: 'Weekly missions' },
    items: [
      { th: 'ทุกสัปดาห์มี 3 ภารกิจ (เหมือนกันทุกคน) ทำครบได้เหรียญ ทำครบติดกันหลายสัปดาห์ได้นับต่อเนื่อง', en: 'Three missions every week (the same for everyone). Finish them for a badge and keep your streak going.' },
      { th: 'กดภารกิจแล้วแผนที่จะกรองน้องที่ใช่ให้เลย เช่น น้องที่ไม่มีใครเจอนาน หรือน้องที่รูปยังน้อย', en: 'Tap a mission and the map filters to the right cats, e.g. not seen lately or few photos' },
      { th: 'ตัวกรองใหม่บนแผนที่: "ไม่มีใครเจอนาน" และ "รูปยังน้อย"', en: 'New map filters: "Not seen lately" and "Few photos"' },
    ],
  },
  {
    id: '2026-10-13-leaderboards',
    date: '2026-10-13',
    title: { th: 'อันดับหลายหมวด และแชมป์ประจำสัปดาห์', en: 'More rankings and weekly champions' },
    items: [
      { th: 'ดูอันดับตามโซนหรือทั้งประเทศ เลือกได้ทั้ง สัปดาห์นี้ / เดือนนี้ / ตลอดกาล', en: 'Rankings by zone or for all of Thailand: this week, this month or all time' },
      { th: 'แยกหมวด: แต้มรวม นักสะสม นักสำรวจ ใจดี ฮีโร่ ช่างภาพ', en: 'Categories: Overall, Collector, Explorer, Kind heart, Hero, Photographer' },
      {
        th: 'ทุกวันจันทร์ประกาศแชมป์ของสัปดาห์ที่แล้ว ได้ป้ายแชมป์ในโปรไฟล์และแจ้งเตือน',
        en: 'Every Monday last week’s champions are announced, with a profile title and a notification',
      },
      { th: 'เจอน้องครบทุกตัวในโซนได้ป้าย "เจอครบ" ในโปรไฟล์', en: 'Find every cat in a zone to earn a "Completed" title' },
    ],
  },
  {
    id: '2026-10-13-share-card',
    date: '2026-10-13',
    title: { th: 'แชร์ลง IG story ได้', en: 'Share to your story' },
    items: [
      { th: 'โปรไฟล์ → สมุดสะสม → "แชร์ลง story" สร้างรูปเจอน้องมาแล้วกี่ตัว พร้อมรูปน้องและป้ายเจ้าถิ่น', en: 'Profile → Cat collection → "Share to story" makes an image with how many cats you found, their photos and your Local Legend titles' },
      { th: 'ปุ่มแชร์ในหน้าน้องทำเป็นรูป story ได้ด้วย หรือจะแชร์ลิงก์แบบเดิมก็ได้', en: 'The share button on a cat page can make a story image too, or share the link as before' },
    ],
  },
  {
    id: '2026-10-13-swipe-close',
    date: '2026-10-13',
    title: { th: 'ปัดลงเพื่อปิดการ์ดน้อง', en: 'Swipe down to close the cat card' },
    items: [
      {
        th: 'ตอนการ์ดเปิดเต็มจอ เลื่อนขึ้นไปบนสุดแล้วปัดลงเพื่อย่อการ์ด ปัดลงยาวๆ เพื่อปิด ไม่ต้องจับที่ขีดด้านบน',
        en: 'With the card full screen, scroll to the top and swipe down to shrink it, or swipe further to close it. No need to grab the bar.',
      },
    ],
  },
  {
    id: '2026-10-13-onsite',
    date: '2026-10-13',
    title: { th: '"เจอ" ต้องอยู่ที่น้องจริง', en: '"Found" means you were really there' },
    items: [
      { th: 'กด "ฉันเจอด้วย" และบันทึกการให้อาหาร ต้องอยู่ใกล้น้องไม่เกิน 300 ม. (ไม่เก็บพิกัดของคุณ)', en: '"I saw it too" and feeding logs need you to be within 300 m of the cat (your location isn’t stored)' },
      { th: 'สมุดสะสมนับเฉพาะสิ่งที่ทำตอนอยู่ที่น้อง รีวิวไม่นับแล้ว ของที่สะสมไว้ก่อนหน้านี้ยังอยู่ครบ', en: 'Your collection only counts things done at the cat; reviews no longer count. Everything you collected before stays.' },
    ],
  },
  {
    id: '2026-10-13-collection',
    date: '2026-10-13',
    title: { th: 'สมุดสะสมน้องแมว และเจ้าถิ่น', en: 'Cat collection and Local Legends' },
    items: [
      { th: 'หมุดถูกจัดเข้าโซนตามเขต/อำเภอให้เอง', en: 'Pins are sorted into zones by district automatically' },
      {
        th: 'โปรไฟล์มีสมุดสะสม: เจอน้องมาแล้วกี่ตัว กี่โซน และแต่ละโซนเจอครบหรือยัง',
        en: 'Your profile shows your collection: how many cats and zones, and how close you are to finding every cat in each zone',
      },
      { th: 'ใครเจอน้องในโซนมากที่สุดได้ฉายา "เจ้าถิ่น" ดูได้ที่ ทาสแมวแถวนี้ → นักสะสมในโซน', en: 'Whoever finds the most cats in a zone becomes its "Local Legend" (see Zone collectors)' },
      {
        th: 'คิดแต้มใหม่: ช่วยน้องสำเร็จได้แต้มเยอะสุด เจอหรือให้อาหารตัวเดิมได้แต้มวันละครั้ง และแจ้งเรื่องอย่างเดียวไม่ได้แต้ม',
        en: 'New scoring: helping a cat earns the most, spotting or feeding the same cat counts once a day, and just reporting earns nothing',
      },
    ],
  },
  {
    id: '2026-10-13-sheet-scroll',
    date: '2026-10-13',
    title: { th: 'เลื่อนดูข้อมูลน้องบนมือถือได้ลื่นขึ้น', en: 'Smoother scrolling on phones' },
    items: [
      {
        th: 'ขยายการ์ดน้องเต็มจอแล้ว ปัดเลื่อนอ่านได้เลยโดยการ์ดไม่เลื่อนตาม ย่อหรือขยายได้ที่ขีดด้านบน',
        en: 'Once the cat card is full screen, swiping just scrolls; drag or tap the bar at the top to shrink or expand it',
      },
      { th: 'กดแท็บ รีวิว หรือ เกี่ยวกับ แล้วการ์ดจะขยายเต็มจอให้เอง', en: 'Tapping Reviews or About expands the card automatically' },
    ],
  },
  {
    id: '2026-10-13-food',
    date: '2026-10-13',
    title: { th: 'อาหารของน้อง', en: 'Feeding the cats' },
    items: [
      { th: 'ตัวกรอง "ยังไม่ได้กินวันนี้" บนแผนที่ ดูได้เลยว่าควรไปหาน้องตัวไหนก่อน', en: 'A "Not fed today" map filter shows which cats to visit first' },
      {
        th: 'บันทึกอาหารแล้วบอกได้ว่าน้องกินหมด กินนิดหน่อย หรือไม่กิน แล้วหน้าน้องจะสรุปว่าน้องชอบกินอะไร',
        en: 'After logging a feeding, say how much the cat ate; the cat page then shows what they like',
      },
      { th: 'คนปักหมุดใส่ข้อควรระวังเรื่องอาหารได้ เช่น แพ้ไก่ ห้ามให้นม จะขึ้นเตือนคนที่มาให้อาหาร', en: 'Pinners can add food warnings (e.g. allergies), shown to anyone feeding the cat' },
    ],
  },
  {
    id: '2026-10-13-help-nearby',
    date: '2026-10-13',
    title: { th: 'ช่วยน้องได้ไวขึ้น', en: 'Help cats faster' },
    items: [
      {
        th: 'เปิด "น้องต้องการความช่วยเหลือใกล้ฉัน" ในหน้าการแจ้งเตือน แล้วจะได้แจ้งเตือนเมื่อมีน้องแถวนั้นต้องการความช่วยเหลือ',
        en: 'Turn on "Cats needing help near me" in Notifications to hear when a cat near you needs help',
      },
      {
        th: 'ปุ่ม "ฉันกำลังไปช่วย" บอกคนอื่นว่ามีคนรับเรื่องแล้ว คนที่แจ้งไว้จะได้แจ้งเตือน',
        en: '"I’m on my way" tells others someone is going, and lets the reporter know',
      },
    ],
  },
  {
    id: '2026-10-12-ui-fixes',
    date: '2026-10-12',
    title: { th: 'แก้หน้าตาเล็กน้อย', en: 'Small UI fixes' },
    items: [
      { th: 'มือถือ: เมนูบัญชีไม่โดนการ์ดน้องแมวบังแล้ว', en: 'Mobile: the account menu no longer hides behind the cat card' },
      { th: 'หน้า "มีอะไรใหม่" เลือกดูทีละวันได้ และแถบเลื่อนในหน้าต่างต่างๆ บางลง', en: 'The "What’s new" page can be filtered by date, and window scrollbars are slimmer' },
    ],
  },
  {
    id: '2026-10-12-photos-2',
    date: '2026-10-12',
    title: { th: 'หน้ารูปภาพใหม่ และเพิ่มรูปได้โดยไม่ต้องรีวิว', en: 'New photo browser, and add photos without a review' },
    items: [
      {
        th: 'แตะรูปใหญ่ของน้องเพื่อเปิดหน้ารูปทั้งหมด มีรายการรูปและรูปใหญ่ให้เลื่อนดู',
        en: 'Tap the big cat photo to open all photos, with a photo list and a large viewer',
      },
      { th: 'กด "เพิ่มรูปภาพ" ในหน้ารูปทั้งหมด เพิ่มได้ทีละหลายรูป ไม่ต้องเขียนรีวิว', en: 'Tap "Add photos" in the photo browser to add several photos, no review needed' },
      { th: 'กดหัวใจรูปที่ชอบได้ ตอนเปิดดูรูปเต็มจอ', en: 'Heart the photos you love in the full-screen view' },
      { th: 'รายงานรูปที่ไม่ใช่น้อง ไม่เหมาะสม หรือละเมิดความเป็นส่วนตัวได้', en: 'Report photos that show the wrong cat, are inappropriate or break privacy' },
      { th: 'ลบรูปที่ตัวเองอัปโหลดได้', en: 'Delete photos you uploaded' },
    ],
  },
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
