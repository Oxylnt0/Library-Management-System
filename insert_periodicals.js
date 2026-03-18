const { db } = require('./db_config.js');

const periodicalsToInsert = [
  {
    issn: "0031-7724", title: "Philippine Law Journal", publisher: "UP College of Law",
    publication_date: "2025-12-01", volume_no: "Vol. 96", issue_no: "Issue 4",
    type: "Journal", genre: "Law", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    total_copies: 2, image_url: ""
  },
  {
    issn: "0740-7459", title: "IEEE Software", publisher: "IEEE Computer Society",
    publication_date: "2026-01-15", volume_no: "Vol. 41", issue_no: "Issue 1",
    type: "Journal", genre: "Computer Science", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    total_copies: 1, image_url: "https://covers.openlibrary.org/b/id/10574765-L.jpg"
  },
  {
    issn: "0028-4793", title: "The New England Journal of Medicine (NEJM)", publisher: "Massachusetts Medical Society",
    publication_date: "2026-02-12", volume_no: "Vol. 390", issue_no: "Issue 6",
    type: "Journal", genre: "Medicine", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    total_copies: 1, image_url: ""
  },
  {
    issn: "0017-8012", title: "Harvard Business Review", publisher: "Harvard Business Publishing",
    publication_date: "2026-03-01", volume_no: "Vol. 104", issue_no: "Spring 2026",
    type: "Magazine", genre: "Business & Management", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    total_copies: 3, image_url: "https://covers.openlibrary.org/b/id/12555541-L.jpg"
  },
  {
    issn: "0027-9358", title: "National Geographic", publisher: "National Geographic Partners",
    publication_date: "2026-02-01", volume_no: "Vol. 245", issue_no: "Feb 2026",
    type: "Magazine", genre: "Science & Nature", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    total_copies: 2, image_url: "https://covers.openlibrary.org/b/id/8259431-L.jpg"
  },
  {
    issn: "0040-781X", title: "TIME Magazine (Asia Edition)", publisher: "Time USA, LLC",
    publication_date: "2026-03-10", volume_no: "Vol. 203", issue_no: "Issue 9",
    type: "Magazine", genre: "Current Events", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    total_copies: 2, image_url: ""
  },
  {
    issn: "0116-0443", title: "Philippine Daily Inquirer", publisher: "Inquirer Group",
    publication_date: "2026-03-18", volume_no: "Vol. 39", issue_no: "No. 101",
    type: "Newspaper", genre: "News & Politics", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    total_copies: 5, image_url: ""
  },
  {
    issn: "0116-3930", title: "The Philippine Star", publisher: "PhilSTAR Media Group",
    publication_date: "2026-03-18", volume_no: "Vol. 38", issue_no: "No. 220",
    type: "Newspaper", genre: "News & Politics", periodical_source: "Purchased", periodical_condition: "New", 
    status: "Available", location: "PER-1: Periodicals & News", 
    total_copies: 4, image_url: ""
  }
];

async function seedPeriodicals() {
  console.log("📰 Starting Parent-Child Periodical Insertion...");

  try {
    let titleCount = 0;
    let copyCount = 0;

    for (const item of periodicalsToInsert) {
    // Step 1: Insert or Find the Parent Title
    const periodicalResult = await db.execute({
      sql: `INSERT INTO PERIODICAL (
              issn, title, publisher, type, genre, 
              page_count, age_restriction, image_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
            ON CONFLICT(issn) DO UPDATE SET title=title 
            RETURNING periodical_id;`,
      args: [
        item.issn, 
        item.title, 
        item.publisher, 
        item.type, 
        item.genre, 
        item.page_count || 0,        // New field
        item.age_restriction || 0,   // New field
        item.image_url
      ]
    });

      const newPeriodicalId = periodicalResult.rows[0].periodical_id;
      titleCount++;

      // Step 2: Loop to create individual physical copies (specific issues)
      for (let i = 0; i < item.total_copies; i++) {
        // Create a unique MATERIAL record for this physical magazine/newspaper
        const materialResult = await db.execute({
          sql: `INSERT INTO MATERIAL (material_type) VALUES ('Periodical') RETURNING material_id;`,
          args: []
        });

        const newMaterialId = materialResult.rows[0].material_id;

        // Create the physical PERIODICAL_COPY
        await db.execute({
          sql: `INSERT INTO PERIODICAL_COPY (
                  periodical_id, material_id, publication_date, issue_no, volume_no,
                  periodical_source, periodical_condition, status, location
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          args: [
            newPeriodicalId,
            newMaterialId,
            item.publication_date,
            item.issue_no,
            item.volume_no,
            item.periodical_source,
            item.periodical_condition,
            item.status,
            item.location
          ]
        });
        copyCount++;
      }
      console.log(`✅ Periodical Cataloged: ${item.title} Issue ${item.issue_no}`);
    }

    console.log(`\n🎉 Success! Cataloged ${titleCount} Titles/Issues and generated ${copyCount} physical copies.`);

  } catch (error) {
    console.error("❌ ERROR inserting periodicals:", error);
  }
}

seedPeriodicals();