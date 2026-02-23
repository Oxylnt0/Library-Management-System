import { db } from "./db_config.js";

const updatedBooksToInsert = [
  {
    isbn: "9780143039641", title: "Noli Me Tangere", author: "Jose Rizal",
    publisher: "Penguin Classics", publication_year: 2006, dewey_decimal: "899.21", genre: "Historical Fiction",
    book_category: "Fiction", book_source: "Purchased", book_condition: "New", status: "Available",
    location: "Filipiniana Section, Shelf A", page_count: 444, age_restriction: 12, available_copies: 5, total_copies: 5,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Noli_Me_Tangere_cover.jpg"
  },
  {
    isbn: "9780553380163", title: "A Brief History of Time", author: "Stephen Hawking",
    publisher: "Bantam", publication_year: 1998, dewey_decimal: "523.1", genre: "Science",
    book_category: "Non-Fiction", book_source: "Donated", book_condition: "Good", status: "Available",
    location: "Science Section, Shelf C", page_count: 212, age_restriction: 13, available_copies: 2, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/isbn/9780553380163-L.jpg"
  },
  {
    isbn: "9780877798095", title: "Merriam-Webster's Collegiate Dictionary", author: "Merriam-Webster",
    publisher: "Merriam-Webster, Inc.", publication_year: 2003, dewey_decimal: "423", genre: "Dictionary",
    book_category: "Reference", book_source: "Purchased", book_condition: "Damaged", status: "Available",
    location: "Reference Section, Desk 1", page_count: 1664, age_restriction: 0, available_copies: 1, total_copies: 1,
    image_url: "https://covers.openlibrary.org/b/isbn/9780877798095-L.jpg"
  },
  {
    isbn: "9780134093413", title: "Campbell Biology", author: "Lisa A. Urry",
    publisher: "Pearson", publication_year: 2016, dewey_decimal: "570", genre: "Biology",
    book_category: "Textbook", book_source: "Donated", book_condition: "Outdated", status: "Archived",
    location: "Storage Room A", page_count: 1488, age_restriction: 15, available_copies: 0, total_copies: 3,
    image_url: "https://covers.openlibrary.org/b/isbn/9780134093413-L.jpg"
  },
  {
    isbn: "9780743273565", title: "The Great Gatsby", author: "F. Scott Fitzgerald",
    publisher: "Scribner", publication_year: 2004, dewey_decimal: "813.52", genre: "Classic Fiction",
    book_category: "Fiction", book_source: "Purchased", book_condition: "New", status: "Available",
    location: "Fiction Section, Shelf C", page_count: 180, age_restriction: 13, available_copies: 6, total_copies: 6,
    image_url: "https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg"
  },
  {
    isbn: "9780553296983", title: "The Diary of a Young Girl", author: "Anne Frank",
    publisher: "Bantam", publication_year: 1993, dewey_decimal: "940.53", genre: "Biography",
    book_category: "Non-Fiction", book_source: "Purchased", book_condition: "Good", status: "Borrowed",
    location: "Biography Section, Shelf A", page_count: 304, age_restriction: 11, available_copies: 2, total_copies: 3,
    image_url: "https://covers.openlibrary.org/b/isbn/9780553296983-L.jpg"
  },
  {
    isbn: "9781118230718", title: "Fundamentals of Physics", author: "David Halliday",
    publisher: "Wiley", publication_year: 2013, dewey_decimal: "530", genre: "Physics",
    book_category: "Textbook", book_source: "Purchased", book_condition: "Good", status: "Available",
    location: "Science Section, Shelf B", page_count: 1200, age_restriction: 15, available_copies: 4, total_copies: 4,
    image_url: "https://covers.openlibrary.org/b/isbn/9781118230718-L.jpg"
  },
  {
    isbn: "9780143106395", title: "El Filibusterismo", author: "Jose Rizal",
    publisher: "Penguin Classics", publication_year: 2011, dewey_decimal: "899.21", genre: "Historical Fiction",
    book_category: "Fiction", book_source: "Donated", book_condition: "Damaged", status: "Available",
    location: "Filipiniana Section, Shelf A", page_count: 352, age_restriction: 12, available_copies: 3, total_copies: 4,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/d/d4/El_Filibusterismo_Cover.jpg"
  },
  {
    isbn: "9781593275846", title: "Eloquent JavaScript", author: "Marijn Haverbeke",
    publisher: "No Starch Press", publication_year: 2014, dewey_decimal: "005.133", genre: "Programming",
    book_category: "Non-Fiction", book_source: "Purchased", book_condition: "Obsolete", status: "Archived",
    location: "Storage Room B", page_count: 472, age_restriction: 14, available_copies: 0, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/isbn/9781593275846-L.jpg"
  },
  {
    isbn: "9780439064873", title: "Harry Potter and the Chamber of Secrets", author: "J.K. Rowling",
    publisher: "Scholastic", publication_year: 2000, dewey_decimal: "823.914", genre: "Fantasy",
    book_category: "Fiction", book_source: "Purchased", book_condition: "New", status: "Available",
    location: "Young Adult Section, Shelf B", page_count: 341, age_restriction: 8, available_copies: 5, total_copies: 5,
    image_url: "https://covers.openlibrary.org/b/isbn/9780439064873-L.jpg"
  }
];

async function seedUpdatedBooks() {
  console.log("📚 Starting Two-Step Book Insertion Process...\n");

  try {
    let successCount = 0;

    for (const book of updatedBooksToInsert) {
      // --- STEP 1: Insert into MATERIAL ---
      const materialResult = await db.execute({
        sql: `
          INSERT INTO MATERIAL (title, material_type, dewey_decimal, publication_year, status) 
          VALUES (?, 'Book', ?, ?, ?) 
          RETURNING material_id
        `,
        // Defaulting material status to match the book's status for consistency
        args: [book.title, book.dewey_decimal, book.publication_year, book.status === 'Archived' ? 'Lost' : 'Available']
      });

      const newMaterialId = materialResult.rows[0].material_id;

      // --- STEP 2: Insert into BOOK ---
      await db.execute({
        sql: `
          INSERT INTO BOOK (
            isbn, title, material_id, author, publisher, publication_year, 
            dewey_decimal, genre, book_category, book_source, book_condition,
            status, location, page_count, age_restriction, 
            available_copies, total_copies, image_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          book.isbn, book.title, newMaterialId, book.author, book.publisher, 
          book.publication_year, book.dewey_decimal, book.genre, 
          book.book_category, book.book_source, book.book_condition,
          book.status, book.location, book.page_count, book.age_restriction, 
          book.available_copies, book.total_copies, book.image_url
        ]
      });

      console.log(`✅ Inserted: ${book.title} | Category: ${book.book_category} | Cond: ${book.book_condition}`);
      successCount++;
    }

    console.log(`\n🎉 Successfully inserted ${successCount} books with all new columns populated!`);

  } catch (error) {
    console.error("❌ ERROR inserting books:", error.message);
  }
}

seedUpdatedBooks();