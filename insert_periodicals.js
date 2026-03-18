const { db } = require('./db_config.js');

const periodicalsToInsert = [
  // ==========================================
  // 📰 ACADEMIC JOURNALS
  // ==========================================
  {
    issn: "0031-7724", title: "Philippine Law Journal", publisher: "UP College of Law",
    publication_date: "2025-12-01", publication_year: 2025, volume_no: "Vol. 96", issue_no: "Issue 4",
    type: "Journal", genre: "Law", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    available_copies: 2, total_copies: 2,
    image_url: ""
  },
  {
    issn: "0740-7459", title: "IEEE Software", publisher: "IEEE Computer Society",
    publication_date: "2026-01-15", publication_year: 2026, volume_no: "Vol. 41", issue_no: "Issue 1",
    type: "Journal", genre: "Computer Science", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    available_copies: 1, total_copies: 1,
    image_url: "https://covers.openlibrary.org/b/id/10574765-L.jpg"
  },
  {
    issn: "0028-4793", title: "The New England Journal of Medicine (NEJM)", publisher: "Massachusetts Medical Society",
    publication_date: "2026-02-12", publication_year: 2026, volume_no: "Vol. 390", issue_no: "Issue 6",
    type: "Journal", genre: "Medicine", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    available_copies: 1, total_copies: 1,
    image_url: ""
  },

  // ==========================================
  // 🗞️ PROFESSIONAL MAGAZINES
  // ==========================================
  {
    issn: "0017-8012", title: "Harvard Business Review", publisher: "Harvard Business Publishing",
    publication_date: "2026-03-01", publication_year: 2026, volume_no: "Vol. 104", issue_no: "Spring 2026",
    type: "Magazine", genre: "Business & Management", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    available_copies: 3, total_copies: 3,
    image_url: "https://covers.openlibrary.org/b/id/12555541-L.jpg"
  },
  {
    // ✨ Updated: Condition is now perfectly "New"
    issn: "0027-9358", title: "National Geographic", publisher: "National Geographic Partners",
    publication_date: "2026-02-01", publication_year: 2026, volume_no: "Vol. 245", issue_no: "Feb 2026",
    type: "Magazine", genre: "Science & Nature", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    available_copies: 2, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/id/8259431-L.jpg"
  },
  {
    issn: "0040-781X", title: "TIME Magazine (Asia Edition)", publisher: "Time USA, LLC",
    publication_date: "2026-03-10", publication_year: 2026, volume_no: "Vol. 203", issue_no: "Issue 9",
    type: "Magazine", genre: "Current Events", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    available_copies: 2, total_copies: 2,
    image_url: ""
  },

  // ==========================================
  // 📰 BROADSHEET NEWSPAPERS
  // ==========================================
  {
    issn: "0116-0443", title: "Philippine Daily Inquirer", publisher: "Inquirer Group",
    publication_date: "2026-03-18", publication_year: 2026, volume_no: "Vol. 39", issue_no: "No. 101",
    type: "Newspaper", genre: "News & Politics", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    available_copies: 5, total_copies: 5,
    image_url: ""
  },
  {
    issn: "0116-3930", title: "The Philippine Star", publisher: "PhilSTAR Media Group",
    publication_date: "2026-03-18", publication_year: 2026, volume_no: "Vol. 38", issue_no: "No. 220",
    type: "Newspaper", genre: "News & Politics", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    available_copies: 4, total_copies: 4,
    image_url: ""
  }
];

async function seedPeriodicals() {
  console.log("📰 Starting Master Periodical Insertion (Pristine Edition)...");

  try {
    let successCount = 0;

    for (const item of periodicalsToInsert) {
      // Step 1: Insert into MATERIAL
      const materialResult = await db.execute({
        sql: `INSERT INTO MATERIAL (title, material_type, dewey_decimal, publication_year, status) 
              VALUES (?, 'Periodical', NULL, ?, ?) RETURNING material_id;`,
        args: [
          item.title, 
          item.publication_year, 
          item.status
        ]
      });

      const newMaterialId = materialResult.rows[0].material_id;

      // Step 2: Insert into PERIODICAL
      await db.execute({
        sql: `INSERT INTO PERIODICAL (
                issn, title, material_id, publisher, publication_date, 
                volume_no, issue_no, type, genre, periodical_source, periodical_condition,
                status, location, available_copies, total_copies, image_url
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          item.issn, item.title, newMaterialId, item.publisher, item.publication_date, 
          item.volume_no, item.issue_no, item.type, item.genre, item.periodical_source, item.periodical_condition,
          item.status, item.location, item.available_copies, item.total_copies, item.image_url
        ]
      });

      console.log(`✅ Mapped: ${item.title} (${item.issue_no}) -> [${item.location}] | Condition: New`);
      successCount++;
    }

    console.log(`\n🎉 Successfully synced ${successCount} pristine Periodicals!`);

  } catch (error) {
    console.error("❌ ERROR inserting periodicals:", error);
  }
}

seedPeriodicals();