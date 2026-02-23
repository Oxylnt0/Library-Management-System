import { db } from "./db_config.js";

const newBooksToInsert = [
  {
    isbn: "9780156012195", title: "The Little Prince", author: "Antoine de Saint-Exupéry",
    publisher: "Harcourt", publication_year: 2000, dewey_decimal: "843.912", genre: "Children's Fiction",
    location: "Children's Section, Shelf A", page_count: 96, age_restriction: 0, available_copies: 4, total_copies: 4,
    image_url: "https://covers.openlibrary.org/b/isbn/9780156012195-L.jpg"
  },
  {
    isbn: "9780061122415", title: "The Alchemist", author: "Paulo Coelho",
    publisher: "HarperOne", publication_year: 2014, dewey_decimal: "869.342", genre: "Philosophical Fiction",
    location: "Fiction Section, Shelf E", page_count: 208, age_restriction: 12, available_copies: 6, total_copies: 6,
    image_url: "https://covers.openlibrary.org/b/isbn/9780061122415-L.jpg"
  },
  {
    isbn: "9789710843685", title: "Florante at Laura", author: "Francisco Balagtas",
    publisher: "National Book Store", publication_year: 1999, dewey_decimal: "899.211", genre: "Epic Poetry",
    location: "Filipiniana Section, Shelf A", page_count: 88, age_restriction: 10, available_copies: 5, total_copies: 5,
    // Using a reliable Wikimedia Commons image for classic PH literature
    image_url: "https://upload.wikimedia.org/wikipedia/commons/3/36/Florante_at_Laura_original_cover.jpg"
  },
  {
    isbn: "9780345339683", title: "The Hobbit", author: "J.R.R. Tolkien",
    publisher: "Del Rey", publication_year: 1986, dewey_decimal: "823.912", genre: "Fantasy",
    location: "Fantasy Section, Shelf A", page_count: 305, age_restriction: 10, available_copies: 3, total_copies: 3,
    image_url: "https://covers.openlibrary.org/b/isbn/9780345339683-L.jpg"
  },
  {
    isbn: "9780439064873", title: "Harry Potter and the Chamber of Secrets", author: "J.K. Rowling",
    publisher: "Scholastic", publication_year: 2000, dewey_decimal: "823.914", genre: "Fantasy",
    location: "Young Adult Section, Shelf B", page_count: 341, age_restriction: 8, available_copies: 5, total_copies: 5,
    image_url: "https://covers.openlibrary.org/b/isbn/9780439064873-L.jpg"
  },
  {
    isbn: "9780486406510", title: "A Tale of Two Cities", author: "Charles Dickens",
    publisher: "Dover Publications", publication_year: 1999, dewey_decimal: "823.8", genre: "Historical Fiction",
    location: "Classic Literature, Shelf B", page_count: 400, age_restriction: 13, available_copies: 2, total_copies: 2,
    image_url: "https://covers.openlibrary.org/b/isbn/9780486406510-L.jpg"
  },
  {
    isbn: "9780553296983", title: "The Diary of a Young Girl", author: "Anne Frank",
    publisher: "Bantam", publication_year: 1993, dewey_decimal: "940.53", genre: "Biography / Memoir",
    location: "Biography Section, Shelf A", page_count: 304, age_restriction: 11, available_copies: 3, total_copies: 3,
    image_url: "https://covers.openlibrary.org/b/isbn/9780553296983-L.jpg"
  },
  {
    isbn: "9780451526342", title: "Animal Farm", author: "George Orwell",
    publisher: "Signet Classic", publication_year: 1996, dewey_decimal: "823.912", genre: "Political Satire",
    location: "Fiction Section, Shelf B", page_count: 144, age_restriction: 12, available_copies: 4, total_copies: 4,
    image_url: "https://covers.openlibrary.org/b/isbn/9780451526342-L.jpg"
  },
  {
    isbn: "9781594631931", title: "The Kite Runner", author: "Khaled Hosseini",
    publisher: "Riverhead Books", publication_year: 2003, dewey_decimal: "813.6", genre: "Historical Fiction",
    location: "Fiction Section, Shelf F", page_count: 371, age_restriction: 15, available_copies: 4, total_copies: 4,
    image_url: "https://covers.openlibrary.org/b/isbn/9781594631931-L.jpg"
  },
  {
    isbn: "9780544336261", title: "The Giver", author: "Lois Lowry",
    publisher: "HMH Books for Young Readers", publication_year: 2014, dewey_decimal: "813.54", genre: "Dystopian",
    location: "Young Adult Section, Shelf C", page_count: 240, age_restriction: 11, available_copies: 5, total_copies: 5,
    image_url: "https://covers.openlibrary.org/b/isbn/9780544336261-L.jpg"
  }
];

async function seedMoreBooks() {
  console.log("📚 Starting Two-Step Book Insertion Process...\n");

  try {
    let successCount = 0;

    for (const book of newBooksToInsert) {
      // --- STEP 1: Insert into MATERIAL ---
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

    console.log(`\n🎉 Successfully inserted ${successCount} new books!`);

  } catch (error) {
    console.error("❌ ERROR inserting books:", error.message);
  }
}

seedMoreBooks();