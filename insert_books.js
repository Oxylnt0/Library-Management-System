const { db } = require('./db_config.js');

const booksToInsert = [
  // ==========================================
  // 📘 TEXTBOOKS (Mapped to Non-Fiction & Front Desk)
  // ==========================================
  {
    isbn: "9781617292231", title: "Grokking Algorithms", author: "Aditya Bhargava",
    publisher: "Manning Publications", publication_year: 2024, volume: null, edition: "2nd Edition",
    dewey_decimal: "005.1", genre: "Computer Science", book_category: "Textbook", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Shelf NF-1: Comp Sci & Info (000-099)", 
    page_count: 256, age_restriction: 0, available_copies: 5, total_copies: 5,
    image_url: "https://covers.openlibrary.org/b/isbn/9781617292231-L.jpg"
  },
  {
    // 🔴 RESTRICTED: Professor's Request (Matches new HTML data-loc)
    isbn: "9780323393041", title: "Gray's Anatomy for Students", author: "Richard Drake",
    publisher: "Elsevier", publication_year: 2023, volume: "Volume 1", edition: "5th Edition",
    dewey_decimal: "611", genre: "Medicine", book_category: "Textbook", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Front Desk", 
    page_count: 1152, age_restriction: 0, available_copies: 3, total_copies: 3,
    image_url: "https://covers.openlibrary.org/b/isbn/9780323393041-L.jpg"
  },
  {
    isbn: "9789712386660", title: "The Revised Penal Code of the Philippines", author: "Luis B. Reyes",
    publisher: "Rex Book Store", publication_year: 2024, volume: "Book 1", edition: "20th Edition",
    dewey_decimal: "345.599", genre: "Law", book_category: "Textbook", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Shelf NF-4: Social Sciences (300-399)", 
    page_count: 1050, age_restriction: 0, available_copies: 4, total_copies: 4,
    image_url: ""
  },
  {
    isbn: "9781260247930", title: "Financial Accounting and Reporting", author: "David Spiceland",
    publisher: "McGraw Hill", publication_year: 2023, volume: null, edition: "6th Edition",
    dewey_decimal: "657.044", genre: "Accounting & Business", book_category: "Textbook", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Shelf NF-7: Technology & Med (600-699)", 
    page_count: 1200, age_restriction: 0, available_copies: 2, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/isbn/9781260247930-L.jpg"
  },

  // ==========================================
  // 📗 REFERENCE (Mapped to REF-1 & Front Desk)
  // ==========================================
  {
    isbn: "9781433832161", title: "Publication Manual of the APA", author: "American Psychological Association",
    publisher: "APA", publication_year: 2020, volume: null, edition: "7th Edition",
    dewey_decimal: "808.06", genre: "Academic Writing", book_category: "Reference", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "REF-1: General Reference", 
    page_count: 428, age_restriction: 0, available_copies: 6, total_copies: 6,
    image_url: "https://covers.openlibrary.org/b/isbn/9781433832161-L.jpg"
  },
  {
    // 🔴 RESTRICTED: High-Value Item (Matches new HTML data-loc)
    isbn: "9780190913038", title: "Oxford Atlas of the World", author: "Oxford University Press",
    publisher: "Oxford", publication_year: 2021, volume: null, edition: "28th Edition",
    dewey_decimal: "912", genre: "Geography", book_category: "Reference", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Front Desk", 
    page_count: 448, age_restriction: 0, available_copies: 1, total_copies: 1,
    image_url: "https://covers.openlibrary.org/b/isbn/9780190913038-L.jpg"
  },
  {
    isbn: "9780877798095", title: "Merriam-Webster's Collegiate Dictionary", author: "Merriam-Webster",
    publisher: "Merriam-Webster, Inc.", publication_year: 2020, volume: null, edition: "11th Edition",
    dewey_decimal: "423", genre: "Dictionary", book_category: "Reference", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "REF-1: General Reference", 
    page_count: 1664, age_restriction: 0, available_copies: 2, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/isbn/9780877798095-L.jpg"
  },

  // ==========================================
  // 📕 FICTION (Mapped to Author Last Name)
  // ==========================================
  {
    isbn: "9780441172719", title: "Dune", author: "Frank Herbert",
    publisher: "Ace Books", publication_year: 1965, volume: "Book 1", edition: "50th Anniversary Ed.",
    dewey_decimal: "813.54", genre: "Science Fiction", book_category: "Fiction", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Shelf FIC-A: Fiction (A-H)", 
    page_count: 412, age_restriction: 13, available_copies: 4, total_copies: 4,
    image_url: "https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg"
  },
  {
    isbn: "9780307269751", title: "The Girl with the Dragon Tattoo", author: "Stieg Larsson",
    publisher: "Knopf", publication_year: 2008, volume: "Book 1", edition: "First US Edition",
    dewey_decimal: "839.738", genre: "Mystery & Thriller", book_category: "Fiction", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Shelf FIC-B: Fiction (I-P)", 
    page_count: 465, age_restriction: 18, available_copies: 2, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/isbn/9780307269751-L.jpg"
  },
  {
    isbn: "9780756404741", title: "The Name of the Wind", author: "Patrick Rothfuss",
    publisher: "DAW Books", publication_year: 2007, volume: "Day One", edition: "10th Anniversary Ed.",
    dewey_decimal: "813.6", genre: "Fantasy", book_category: "Fiction", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Shelf FIC-C: Fiction (Q-Z)", 
    page_count: 662, age_restriction: 13, available_copies: 5, total_copies: 5,
    image_url: "https://covers.openlibrary.org/b/isbn/9780756404741-L.jpg"
  },
  {
    isbn: "9780374175282", title: "Ilustrado", author: "Miguel Syjuco",
    publisher: "Farrar, Straus and Giroux", publication_year: 2010, volume: null, edition: null,
    dewey_decimal: "899.21", genre: "Filipiniana", book_category: "Fiction", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Shelf FIC-C: Fiction (Q-Z)", 
    page_count: 320, age_restriction: 15, available_copies: 3, total_copies: 3,
    image_url: "https://covers.openlibrary.org/b/isbn/9780374175282-L.jpg"
  },

  // ==========================================
  // 📙 NON-FICTION (Mapped to Non-Fiction DDC Shelves)
  // ==========================================
  {
    isbn: "9780735211292", title: "Atomic Habits", author: "James Clear",
    publisher: "Avery", publication_year: 2018, volume: null, edition: null,
    dewey_decimal: "158.1", genre: "Self-Help", book_category: "Non-Fiction", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Shelf NF-2: Philosophy & Psych (100-199)", 
    page_count: 320, age_restriction: 12, available_copies: 7, total_copies: 7,
    image_url: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg"
  },
  {
    isbn: "9781501127625", title: "Steve Jobs", author: "Walter Isaacson",
    publisher: "Simon & Schuster", publication_year: 2011, volume: null, edition: "Hardcover Ed.",
    dewey_decimal: "920", genre: "Biography", book_category: "Non-Fiction", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Shelf NF-10: History & Geo (900-999)", 
    page_count: 630, age_restriction: 12, available_copies: 2, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/isbn/9781501127625-L.jpg"
  },
  {
    isbn: "9780812968255", title: "Meditations", author: "Marcus Aurelius",
    publisher: "Modern Library", publication_year: 2002, volume: null, edition: "Gregory Hays Translation",
    dewey_decimal: "188", genre: "Philosophy", book_category: "Non-Fiction", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Shelf NF-2: Philosophy & Psych (100-199)", 
    page_count: 254, age_restriction: 15, available_copies: 3, total_copies: 3,
    image_url: "https://covers.openlibrary.org/b/isbn/9780812968255-L.jpg"
  },
  {
    isbn: "9789715501861", title: "The Philippines: A Past Revisited", author: "Renato Constantino",
    publisher: "Constantino", publication_year: 1975, volume: "Vol 1", edition: null,
    dewey_decimal: "959.9", genre: "History", book_category: "Non-Fiction", book_source: "Purchased", 
    book_condition: "New", status: "Available", location: "Shelf NF-10: History & Geo (900-999)", 
    page_count: 413, age_restriction: 12, available_copies: 4, total_copies: 4,
    image_url: "https://covers.openlibrary.org/b/isbn/9789715501861-L.jpg"
  }
];

async function seedBooks() {
  console.log("📚 Starting Master Book Insertion (Front Desk Edition)...");

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
                volume, edition, dewey_decimal, genre, book_category, book_source, book_condition,
                status, location, page_count, age_restriction, 
                available_copies, total_copies, image_url
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          book.isbn, book.title, newMaterialId, book.author, book.publisher, 
          book.publication_year, book.volume || null, book.edition || null, 
          book.dewey_decimal, book.genre, book.book_category, book.book_source, book.book_condition,
          book.status, book.location, book.page_count, book.age_restriction, 
          book.available_copies, book.total_copies, book.image_url
        ]
      });

      console.log(`✅ Mapped: ${book.title} -> [${book.location}]`);
      successCount++;
    }

    console.log(`\n🎉 Successfully synced ${successCount} pristine, new books. Closed Reserve logic is ready!`);

  } catch (error) {
    console.error("❌ ERROR inserting books:", error);
  }
}

seedBooks();