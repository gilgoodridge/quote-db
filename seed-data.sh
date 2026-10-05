#!/bin/bash

# Seed data script for quote-db
# Works with Git Bash (Windows) and standard Ubuntu bash (Linux)
# Usage: ./seed-data.sh [BASE_URL]
# Example: ./seed-data.sh http://localhost:8080

BASE_URL="${1:-http://localhost:8080}"
API_URL="$BASE_URL/api"

echo "Seeding database at $API_URL"
echo "=========================================="

# Helper function to make API calls and extract ID
create_author() {
    local given_name="$1"
    local family_name="$2"
    local date_of_birth="$3"
    local date_of_death="$4"
    local nationality="$5"
    
    local response=$(curl -s -X POST "$API_URL/authors" \
        -H "Content-Type: application/json" \
        -d "{
            \"givenName\": \"$given_name\",
            \"familyName\": \"$family_name\",
            \"dateOfBirth\": \"$date_of_birth\",
            \"dateOfDeath\": \"$date_of_death\",
            \"nationality\": \"$nationality\"
        }")
    
    local id=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
    echo "$id"
}

# Helper function to create a quote
create_quote() {
    local text="$1"
    local author_id="$2"
    local date="$3"
    local location="$4"
    local reference="$5"
    
    local json="{
        \"text\": \"$text\",
        \"authorId\": $author_id"
    
    if [ -n "$date" ]; then
        json="$json, \"date\": \"$date\""
    fi
    
    if [ -n "$location" ]; then
        json="$json, \"location\": \"$location\""
    fi
    
    if [ -n "$reference" ]; then
        json="$json, \"reference\": \"$reference\""
    fi
    
    json="$json}"
    
    curl -s -X POST "$API_URL/quotes" \
        -H "Content-Type: application/json" \
        -d "$json" > /dev/null
}

echo "Creating authors..."
echo "----------------------------------------"

# Create authors
EINSTEIN_ID=$(create_author "Albert" "Einstein" "1879-03-14" "1955-04-18" "German/Swiss/American")
echo "✓ Albert Einstein (ID: $EINSTEIN_ID)"

CHURCHILL_ID=$(create_author "Winston" "Churchill" "1874-01-30" "1965-01-24" "British")
echo "✓ Winston Churchill (ID: $CHURCHILL_ID)"

TWAIN_ID=$(create_author "Mark" "Twain" "1835-11-30" "1910-04-21" "American")
echo "✓ Mark Twain (ID: $TWAIN_ID)"

AUSTEN_ID=$(create_author "Jane" "Austen" "1775-12-16" "1817-07-18" "British")
echo "✓ Jane Austen (ID: $AUSTEN_ID)"

DARWIN_ID=$(create_author "Charles" "Darwin" "1809-02-12" "1882-04-19" "British")
echo "✓ Charles Darwin (ID: $DARWIN_ID)"

SHAKESPEARE_ID=$(create_author "William" "Shakespeare" "1564-04-23" "1616-05-03" "British")
echo "✓ William Shakespeare (ID: $SHAKESPEARE_ID)"

JOBS_ID=$(create_author "Steve" "Jobs" "1955-02-24" "2011-10-05" "American")
echo "✓ Steve Jobs (ID: $JOBS_ID)"

echo ""
echo "Creating quotes..."
echo "----------------------------------------"

# Einstein quotes
create_quote "Life is like riding a bicycle. To keep your balance, you must keep moving." "$EINSTEIN_ID" "1950-05-23" "In a letter" "https://www.goodreads.com/quotes/11621"
echo "✓ Einstein quote 1"

create_quote "Imagination is more important than knowledge. Knowledge is limited to what we already know and understand." "$EINSTEIN_ID" "" "" "https://www.goodreads.com/quotes/6060"
echo "✓ Einstein quote 2"

create_quote "In the middle of difficulty lies opportunity." "$EINSTEIN_ID" "" "" ""
echo "✓ Einstein quote 3"

create_quote "Life is not a problem to be solved, but a reality to be experienced." "$EINSTEIN_ID" "" "" ""
echo "✓ Einstein quote 4"

# Churchill quotes
create_quote "Never give up. Never surrender." "$CHURCHILL_ID" "1941-06-18" "Speech" "https://en.wikiquote.org/wiki/Winston_Churchill"
echo "✓ Churchill quote 1"

create_quote "Success is not final, failure is not fatal: it is the courage to continue that counts." "$CHURCHILL_ID" "" "" "https://www.goodreads.com/quotes/11470"
echo "✓ Churchill quote 2"

create_quote "We are all worms. But I do believe I am a glow-worm." "$CHURCHILL_ID" "" "Parliament" ""
echo "✓ Churchill quote 3"

# Twain quotes
create_quote "The secret of getting ahead is getting started." "$TWAIN_ID" "" "" "https://www.goodreads.com/quotes/24723"
echo "✓ Twain quote 1"

create_quote "If you tell the truth, you don't have to remember anything." "$TWAIN_ID" "" "" "https://www.goodreads.com/quotes/3325"
echo "✓ Twain quote 2"

create_quote "Eat a live frog first thing in the morning and nothing worse will happen to you the rest of the day." "$TWAIN_ID" "" "" ""
echo "✓ Twain quote 3"

# Austen quotes
create_quote "There is nothing I would not do for those who are really my friends." "$AUSTEN_ID" "" "" "https://www.goodreads.com/quotes/10126"
echo "✓ Austen quote 1"

create_quote "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife." "$AUSTEN_ID" "1813-01-28" "Pride and Prejudice" ""
echo "✓ Austen quote 2"

# Darwin quotes
create_quote "It is not the strongest of the species that survives, nor the most intelligent, but the one most responsive to change." "$DARWIN_ID" "" "" ""
echo "✓ Darwin quote 1"

create_quote "There is grandeur in this view of life." "$DARWIN_ID" "1859-11-24" "On the Origin of Species" ""
echo "✓ Darwin quote 2"

# Shakespeare quotes
create_quote "All the world's a stage, and all the men and women merely players." "$SHAKESPEARE_ID" "" "As You Like It" ""
echo "✓ Shakespeare quote 1"

create_quote "To be, or not to be, that is the question." "$SHAKESPEARE_ID" "" "Hamlet" ""
echo "✓ Shakespeare quote 2"

create_quote "Some Cupid kills with arrows, some with traps." "$SHAKESPEARE_ID" "" "Much Ado About Nothing" ""
echo "✓ Shakespeare quote 3"

# Jobs quotes
create_quote "The only way to do great work is to love what you do." "$JOBS_ID" "" "Stanford University" "https://www.goodreads.com/quotes/32963"
echo "✓ Jobs quote 1"

create_quote "Innovation distinguishes between a leader and a follower." "$JOBS_ID" "" "" "https://www.goodreads.com/quotes/34043"
echo "✓ Jobs quote 2"

create_quote "Stay hungry. Stay foolish." "$JOBS_ID" "1997-10-12" "Apple Keynote" ""
echo "✓ Jobs quote 3"

echo ""
echo "=========================================="
echo "✓ Database seeded successfully!"
echo ""
echo "Summary:"
echo "  - 7 authors created"
echo "  - 21 quotes created"
