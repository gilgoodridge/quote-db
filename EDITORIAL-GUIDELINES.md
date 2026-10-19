# Editorial Guidelines

This guide is for people creating and editing authors and quotes in Quote DB.
It describes how to choose field values consistently, not just what the
application accepts. It can also serve as the basis for future in-app help.

The author-name rules below are established guidance. Sections marked
**To be defined** are placeholders, not settled editorial policy. Field names
in parentheses identify the corresponding API fields.

## Author names

### Full name (`fullName`)

**Required.** Record the most complete, well-supported personal name you choose
to use for the person in this catalog.

- This is not a claim about the person's current legal name. Do not interpret
  "full name" as requiring legal records or a verified legal identity.
- Keep the name in one field; do not split it into given and family names.
  Names do not all follow the same structure.
- Include well-supported middle names where appropriate, but do not guess
  missing names or expand initials without evidence.
- Preserve the spelling and diacritics of the name being recorded.
- Leave out honorifics, academic titles, and offices; see [Titles](#titles).

### Known as (`knownAs`)

**Optional.** Record the recognizable name to use when displaying and identifying
the author. This can be a pen name, religious name, nickname, or familiar shorter
form. It is an editorial choice about recognition, not a claim about what the
person preferred to be called.

When this field is supplied, the author sidebar and quote-author dropdown show
it instead of the full name. When it is blank, they show the full name.

- Choose one display name, not a list of alternatives.
- Use the name by which readers are most likely to recognize the person.
- Leave it blank when the full name is already the name you want displayed;
  repeating the full name is unnecessary.
- Do not add titles just to make the attribution sound more formal.

| Full name | Known as | Displayed name |
|-----------|----------|----------------|
| Anjezë Gonxhe Bojaxhiu | Mother Teresa | Mother Teresa |
| Samuel Langhorne Clemens | Mark Twain | Mark Twain |
| Winston Leonard Spencer Churchill | Winston Churchill | Winston Churchill |
| Steven Paul Jobs | Steve Jobs | Steve Jobs |
| Jane Austen | Leave blank | Jane Austen |

### Titles

Normally omit titles such as "Sir," "President," "Senator," and "Dr." from both
name fields. For example, use "George Washington" rather than "President George
Washington," and "Grace Hopper" rather than "Dr. Grace Hopper."

Do not change an author's display name according to the date of a quote.
Something Barack Obama said while campaigning for president should still be
attributed to "Barack Obama," without needing to decide whether "Senator" or
"President" applies. This catalog does not track titles or offices by date.

Distinguish an added title from an established public name: "Mother Teresa" is
the recognizable name itself, so keep "Mother" in that known-as name.

There is currently no separate title field. Do not put titles into another field
just to retain them. A dedicated title or honorific field could be considered
later if there is an editorial use for it; it would not automatically become
part of the displayed attribution.

### Two similarly familiar names

Choose one consistent known-as name for the author across quotes. Recognizability
comes first, but when two forms are comparably familiar, prefer the form closer
to the formal name. Treat a roughly 50/50 or even 40/60 split as a judgment call,
not a requirement to measure name popularity.

Examples of applying that tie-breaker:

- Prefer "Franklin Roosevelt" over "FDR" when neither clearly dominates for the
  intended readership.
- Prefer "Theodore Roosevelt" over "Teddy Roosevelt" under the same conditions.
- Prefer "John F. Kennedy" over "Jack Kennedy" under the same conditions.

This is not a rule against nicknames or initials. If a particular form is clearly
the established public name, use it. Do not create separate author records for
different names of the same person.

### Maiden names, married names, and other name changes

The full-name field is not necessarily a birth-name field, nor must it always
contain the person's latest name. Choose a well-supported full name that best
represents the person in the catalog, and use the known-as field for the familiar
public name.

A combined form such as "Hillary Diane Rodham Clinton" can be appropriate, with
"Hillary Clinton" as the known-as name. However, do not mechanically combine
every former and current name into a name the person never used or that sources
do not support.

Do not put a timeline, a list of former names, or a parenthetical "née" annotation
in either name field. Do not switch between separate author records when quoting
the person before and after a name change.

There are currently no separate birth-name, former-name, or alias fields.
Recording those names as structured data is deferred until there is a clear need,
such as searching by alternate names. Neither field needs to preserve a complete
name history.

## Other author fields

The following fields exist, but their detailed editorial rules are
**To be defined**. Leave optional values blank when unknown rather than inventing
information to fill them.

| Field | Current format or limit | Editorial rules to define |
|-------|-------------------------|---------------------------|
| Date of birth (`dateOfBirth`) | Optional date: `YYYY-MM-DD` | Sources, uncertain dates, and dates known only to the year or month |
| Date of death (`dateOfDeath`) | Optional date: `YYYY-MM-DD` | Sources, uncertain dates, and distinguishing unknown from not applicable |
| Place of birth (`placeOfBirth`) | Optional text; up to 255 characters in the form | Geographic detail, historical versus current place names, and formatting |
| Nationality (`nationality`) | Optional text; up to 255 characters in the form | Country names, multiple nationalities, and changes over a lifetime |
| Biography (`bio`) | Optional text; up to 1,024 characters | Scope, tone, sourcing, and treatment of alternate names |

Partial or uncertain dates are not currently represented by the date fields.
The future rules must account for that limitation rather than imply support
for approximate dates.

## Quote fields

The following fields exist, but their detailed editorial rules are
**To be defined**.

| Field | Current format or limit | Editorial rules to define |
|-------|-------------------------|---------------------------|
| Text (`text`) | Required by the form; up to 2,048 characters | Exact wording, punctuation, excerpts, ellipses, translations, and corrections |
| Author (`authorId`) | Required selection of an existing author | Attribution evidence, disputed authorship, anonymous quotes, and avoiding duplicate author records |
| Date (`date`) | Optional date: `YYYY-MM-DD` | Date spoken versus date published, uncertain dates, and partial dates |
| Location (`location`) | Optional text; up to 255 characters in the form | Physical locations versus event or work titles, and consistent formatting |
| Reference (`reference`) | Optional text; up to 255 characters in the form | Primary sources, URLs, publication details, page numbers, and citation format |

## Cross-cutting editorial topics

**To be defined:**

- Minimum sourcing and verification before adding a quote.
- Handling misattributed, disputed, and paraphrased quotations.
- Duplicate detection for authors and quotes.
- Language and translation conventions.
- Review and correction of existing entries.
