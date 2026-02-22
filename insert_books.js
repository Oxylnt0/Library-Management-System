import { db } from "./db_config.js";

const booksToInsert = [
  {
    isbn: "9780143039641", title: "Noli Me Tangere", author: "Jose Rizal",
    publisher: "Penguin Classics", publication_year: 2006, dewey_decimal: "899.21", genre: "Historical Fiction",
    location: "Filipiniana Section, Shelf A", page_count: 444, age_restriction: 12, available_copies: 5, total_copies: 5,
    image_url: "https://covers.openlibrary.org/b/isbn/9780143039641-L.jpg"
  },
  {
    isbn: "9780143106395", title: "El Filibusterismo", author: "Jose Rizal",
    publisher: "Penguin Classics", publication_year: 2011, dewey_decimal: "899.21", genre: "Historical Fiction",
    location: "Filipiniana Section, Shelf A", page_count: 352, age_restriction: 12, available_copies: 4, total_copies: 4,
    image_url: "https://covers.openlibrary.org/b/isbn/9780143106395-L.jpg"
  },
  {
    isbn: "9780451524935", title: "1984", author: "George Orwell",
    publisher: "Signet Classic", publication_year: 1961, dewey_decimal: "823.912", genre: "Dystopian",
    location: "Fiction Section, Shelf B", page_count: 328, age_restriction: 14, available_copies: 3, total_copies: 3,
    image_url: "https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg"
  },
  {
    isbn: "9780060935467", title: "To Kill a Mockingbird", author: "Harper Lee",
    publisher: "Harper Perennial", publication_year: 2002, dewey_decimal: "813.54", genre: "Classic Fiction",
    location: "Fiction Section, Shelf C", page_count: 324, age_restriction: 12, available_copies: 2, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/isbn/9780060935467-L.jpg"
  },
  {
    isbn: "9780743273565", title: "The Great Gatsby", author: "F. Scott Fitzgerald",
    publisher: "Scribner", publication_year: 2004, dewey_decimal: "813.52", genre: "Classic Fiction",
    location: "Fiction Section, Shelf C", page_count: 180, age_restriction: 13, available_copies: 6, total_copies: 6,
    image_url: "https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg"
  },
  {
    isbn: "9780141439518", title: "Pride and Prejudice", author: "Jane Austen",
    publisher: "Penguin Classics", publication_year: 2002, dewey_decimal: "823.7", genre: "Romance",
    location: "Romance Section, Shelf A", page_count: 480, age_restriction: 10, available_copies: 3, total_copies: 3,
    image_url: "https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg"
  },
  {
    isbn: "9780316769488", title: "The Catcher in the Rye", author: "J.D. Salinger",
    publisher: "Little, Brown and Company", publication_year: 2001, dewey_decimal: "813.54", genre: "Coming-of-age",
    location: "Fiction Section, Shelf D", page_count: 277, age_restriction: 14, available_copies: 2, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/isbn/9780316769488-L.jpg"
  },
  {
    isbn: "9781451673319", title: "Fahrenheit 451", author: "Ray Bradbury",
    publisher: "Simon & Schuster", publication_year: 2012, dewey_decimal: "813.54", genre: "Sci-Fi",
    location: "Sci-Fi Section, Shelf A", page_count: 249, age_restriction: 13, available_copies: 4, total_copies: 4,
    image_url: "https://covers.openlibrary.org/b/isbn/9781451673319-L.jpg"
  },
  {
    isbn: "9780544003415", title: "The Lord of the Rings: The Fellowship of the Ring", author: "J.R.R. Tolkien",
    publisher: "Mariner Books", publication_year: 2012, dewey_decimal: "823.912", genre: "Fantasy",
    location: "Fantasy Section, Shelf A", page_count: 432, age_restriction: 10, available_copies: 3, total_copies: 3,
    image_url: "https://covers.openlibrary.org/b/isbn/9780544003415-L.jpg"
  },
  {
    isbn: "9780590353427", title: "Harry Potter and the Sorcerer's Stone", author: "J.K. Rowling",
    publisher: "Scholastic", publication_year: 1998, dewey_decimal: "823.914", genre: "Fantasy",
    location: "Young Adult Section, Shelf B", page_count: 309, age_restriction: 8, available_copies: 7, total_copies: 7,
    image_url: "https://covers.openlibrary.org/b/isbn/9780590353427-L.jpg"
  }
];

async function seedBooks() {
  console.log("📚 Starting Two-Step Book Insertion Process...\n");

  try {
    let successCount = 0;

    for (const book of booksToInsert) {
      // --- STEP 1: Insert into MATERIAL ---
      // We use RETURNING material_id to instantly grab the ID of the new row.
      const materialResult = await db.execute({
        sql: `
          INSERT INTO MATERIAL (title, material_type, dewey_decimal, publication_year, status) 
          VALUES (?, 'Book', ?, ?, 'Available') 
          RETURNING material_id
        `,
        args: [book.title, book.dewey_decimal, book.publication_year]
      });

      const newMaterialId = materialResult.rows[0].material_id;

      // --- STEP 2: Insert into BOOK ---
      // We pass the newMaterialId into the material_id column here.
      await db.execute({
        sql: `
          INSERT INTO BOOK (
            isbn, title, material_id, author, publisher, publication_year, 
            dewey_decimal, genre, location, page_count, age_restriction, 
            available_copies, total_copies, image_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          book.isbn, book.title, newMaterialId, book.author, book.publisher, 
          book.publication_year, book.dewey_decimal, book.genre, book.location, 
          book.page_count, book.age_restriction, book.available_copies, 
          book.total_copies, book.image_url
        ]
      });

      console.log(`✅ Inserted: ${book.title} (Material ID: ${newMaterialId})`);
      successCount++;
    }

    console.log(`\n🎉 Successfully inserted ${successCount} books into both tables!`);

  } catch (error) {
    console.error("❌ ERROR inserting books:", error.message);
  }
}

seedBooks();