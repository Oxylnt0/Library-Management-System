const { db } = require('./db_config.js');

const booksToInsert = [
  {
    isbn: "9780877798095", title: "Merriam-Webster's Collegiate Dictionary", author: "Merriam-Webster",
    publisher: "Merriam-Webster, Inc.", publication_year: 2003, dewey_decimal: "423", genre: "Dictionary",
    book_category: "Reference", book_source: "Purchased", book_condition: "Good", status: "Available",
    location: "Reference Section, Desk 1", page_count: 1664, age_restriction: 0, available_copies: 1, total_copies: 1,
    image_url: "https://covers.openlibrary.org/b/isbn/9780877798095-L.jpg"
  },
  {
    isbn: "9780134093413", title: "Campbell Biology", author: "Lisa A. Urry",
    publisher: "Pearson", publication_year: 2016, dewey_decimal: "570", genre: "Biology",
    book_category: "Textbook", book_source: "Purchased", book_condition: "New", status: "Available",
    location: "Science Section, Shelf A", page_count: 1488, age_restriction: 15, available_copies: 5, total_copies: 5,
    image_url: "https://covers.openlibrary.org/b/isbn/9780134093413-L.jpg"
  },
  {
    isbn: "9780743273565", title: "The Great Gatsby", author: "F. Scott Fitzgerald",
    publisher: "Scribner", publication_year: 2004, dewey_decimal: "813.52", genre: "Classic Fiction",
    book_category: "Fiction", book_source: "Donated", book_condition: "Damaged", status: "Available",
    location: "Fiction Section, Shelf C", page_count: 180, age_restriction: 13, available_copies: 1, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg"
  },
  {
    isbn: "9780590353427", title: "Harry Potter and the Sorcerer's Stone", author: "J.K. Rowling",
    publisher: "Scholastic", publication_year: 1998, dewey_decimal: "823.914", genre: "Fantasy",
    book_category: "Fiction", book_source: "Purchased", book_condition: "Good", status: "Available",
    location: "Fiction Section, Shelf H", page_count: 309, age_restriction: 9, available_copies: 3, total_copies: 3,
    image_url: "https://covers.openlibrary.org/b/isbn/9780590353427-L.jpg"
  },
  {
    isbn: "9780735211292", title: "Atomic Habits", author: "James Clear",
    publisher: "Avery", publication_year: 2018, dewey_decimal: "158.1", genre: "Self-Help",
    book_category: "Non-Fiction", book_source: "Purchased", book_condition: "New", status: "Available",
    location: "Self-Help Section, Shelf A", page_count: 320, age_restriction: 13, available_copies: 2, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg"
  },
];

async function seedBooks() {
  console.log("📚 Starting Book Insertion...");

  try {
    let successCount = 0;

    for (const book of booksToInsert) {
      // Step 1: Insert into MATERIAL using parameterized arguments (?)
      const materialResult = await db.execute({
        sql: `INSERT INTO MATERIAL (title, material_type, dewey_decimal, publication_year, status) 
              VALUES (?, 'Book', ?, ?, ?) RETURNING material_id;`,
        args: [
          book.title, 
          book.dewey_decimal, 
          book.publication_year, 
          book.status === 'Archived' ? 'Lost' : 'Available'
        ]
      });

      const newMaterialId = materialResult.rows[0].material_id;

      // Step 2: Insert into BOOK using parameterized arguments (?)
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

      console.log(`✅ Inserted: ${book.title}`);
      successCount++;
    }

    console.log(`\n🎉 Successfully inserted ${successCount} books!`);

  } catch (error) {
    console.error("❌ ERROR inserting books:", error);
  }
}

seedBooks();