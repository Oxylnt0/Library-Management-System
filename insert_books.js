const { db } = require('./db_config.js');

const booksToInsert = [
  // ==========================================
  // 🟢 NORMAL / TIMELESS BOOKS (Status: Retain)
  // ==========================================
  {
    // 1. Fiction is timeless. Even though it's from 1998, it is never weeded.
    isbn: "9780590353427", title: "Harry Potter and the Sorcerer's Stone", author: "J.K. Rowling",
    publisher: "Scholastic", publication_year: 1998, dewey_decimal: "823.914", 
    genre: "Fantasy", book_category: "Fiction", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Fiction Section, Shelf H", 
    page_count: 309, age_restriction: 9, available_copies: 3, total_copies: 3,
    image_url: "https://covers.openlibrary.org/b/isbn/9780590353427-L.jpg"
  },
  {
    // 2. Self-Help takes 15 years to become outdated. This is 8 years old (2018), so it is safe.
    isbn: "9780735211292", title: "Atomic Habits", author: "James Clear",
    publisher: "Avery", publication_year: 2018, dewey_decimal: "158.1", 
    genre: "Self-Help & Motivation", book_category: "Non-Fiction", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Self-Help Section, Shelf A", 
    page_count: 320, age_restriction: 13, available_copies: 2, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg"
  },
  {
    // 3. Filipiniana is a protected cultural genre. Age does not matter.
    isbn: "9780143039642", title: "Noli Me Tangere", author: "Jose Rizal",
    publisher: "Penguin Classics", publication_year: 2006, dewey_decimal: "899.2113", 
    genre: "Filipiniana", book_category: "Fiction", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Filipiniana Section, Shelf 1", 
    page_count: 444, age_restriction: 12, available_copies: 4, total_copies: 4,
    image_url: "https://covers.openlibrary.org/b/isbn/9780143039642-L.jpg"
  },

  // ==========================================
  // 🟡 OUTDATED BOOKS (Hit the 10-year limit)
  // ==========================================
  {
    // 4. Biology: 12 years old (2014). Science hits the Outdated mark at 10 years.
    isbn: "9780321775658", title: "Campbell Biology (10th Edition)", author: "Jane B. Reece",
    publisher: "Pearson", publication_year: 2014, dewey_decimal: "570", 
    genre: "Biology & Life Sciences", book_category: "Textbook", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Science Section, Shelf B", 
    page_count: 1488, age_restriction: 15, available_copies: 5, total_copies: 5,
    image_url: "https://covers.openlibrary.org/b/isbn/9780321775658-L.jpg"
  },
  {
    // 5. Business: 14 years old (2012). Market data is old. Outdated at 10 years.
    isbn: "9780538453059", title: "Principles of Economics", author: "N. Gregory Mankiw",
    publisher: "Cengage", publication_year: 2012, dewey_decimal: "330", 
    genre: "Business & Economics", book_category: "Textbook", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Business Section, Shelf 2", 
    page_count: 888, age_restriction: 15, available_copies: 2, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/isbn/9780538453059-L.jpg"
  },
  {
    // 6. Encyclopedia: 16 years old (2010). Missing modern history. Outdated at 10 years.
    isbn: "9781593398378", title: "Encyclopedia Britannica 2010", author: "Britannica",
    publisher: "Britannica", publication_year: 2010, dewey_decimal: "031", 
    genre: "Encyclopedia", book_category: "Reference", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Reference Section, Desk", 
    page_count: 1200, age_restriction: 0, available_copies: 1, total_copies: 1,
    image_url: "https://covers.openlibrary.org/b/isbn/9781593398378-L.jpg"
  },

  // ==========================================
  // 🔴 OBSOLETE BOOKS (Hit the 5-year limit)
  // ==========================================
  {
    // 7. Technology: 8 years old (2018). Tech becomes Obsolete in just 5 years.
    isbn: "9781119527032", title: "Mastering Windows Server 2019", author: "Jordan Krause",
    publisher: "Sybex", publication_year: 2018, dewey_decimal: "005.4", 
    genre: "Computer Science & Technology", book_category: "Textbook", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Tech Section, Shelf 1", 
    page_count: 800, age_restriction: 0, available_copies: 3, total_copies: 3,
    image_url: "https://covers.openlibrary.org/b/isbn/9781119527032-L.jpg"
  },
  {
    // 8. Medicine: 11 years old (2015). Medical books become Obsolete in 5 years due to safety.
    isbn: "9781455704187", title: "Nursing Drug Handbook 2015", author: "Elsevier",
    publisher: "Mosby", publication_year: 2015, dewey_decimal: "615.1", 
    genre: "Medicine & Health", book_category: "Reference", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Medical Section, Shelf 3", 
    page_count: 1400, age_restriction: 16, available_copies: 2, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/isbn/9781455704187-L.jpg"
  },
  {
    // 9. Law: 9 years old (2017). Laws change quickly. Obsolete in 5 years.
    isbn: "9789712368000", title: "The National Internal Revenue Code of 1997 (2017 Ed)", author: "Hector De Leon",
    publisher: "Rex Book Store", publication_year: 2017, dewey_decimal: "343.599", 
    genre: "Law & Politics", book_category: "Textbook", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Law Section, Shelf 2", 
    page_count: 950, age_restriction: 0, available_copies: 4, total_copies: 4,
    image_url: ""
  }
];

async function seedBooks() {
  console.log("📚 Starting Master Book Insertion...");

  try {
    let successCount = 0;

    for (const book of booksToInsert) {
      // Step 1: Insert into MATERIAL
      const materialResult = await db.execute({
        sql: `INSERT INTO MATERIAL (title, material_type, dewey_decimal, publication_year, status) 
              VALUES (?, 'Book', ?, ?, ?) RETURNING material_id;`,
        args: [
          book.title, 
          book.dewey_decimal, 
          book.publication_year, 
          book.status
        ]
      });

      const newMaterialId = materialResult.rows[0].material_id;

      // Step 2: Insert into BOOK
      await db.execute({
        sql: `INSERT INTO BOOK (
                isbn, title, material_id, author, publisher, publication_year, 
                dewey_decimal, genre, book_category, book_source, book_condition,
                status, location, page_count, age_restriction, 
                available_copies, total_copies, image_url
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          book.isbn, book.title, newMaterialId, book.author, book.publisher, 
          book.publication_year, book.dewey_decimal, book.genre, 
          book.book_category, book.book_source, book.book_condition,
          book.status, book.location, book.page_count, book.age_restriction, 
          book.available_copies, book.total_copies, book.image_url
        ]
      });

      console.log(`✅ Inserted: ${book.title} | Genre: ${book.genre} | Year: ${book.publication_year}`);
      successCount++;
    }

    console.log(`\n🎉 Successfully inserted ${successCount} perfectly categorized books!`);

  } catch (error) {
    console.error("❌ ERROR inserting books:", error);
  }
}

seedBooks();