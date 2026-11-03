ALTER TABLE tones ADD COLUMN description VARCHAR(255);
ALTER TABLE themes ADD COLUMN description VARCHAR(255);
ALTER TABLE forms ADD COLUMN description VARCHAR(255);
ALTER TABLE sources ADD COLUMN description VARCHAR(255);

UPDATE tones SET description = CASE name
    WHEN 'Inspirational' THEN 'Encourages hope, motivation, or the confidence to act.'
    WHEN 'Funny' THEN 'Amuses through wit, irony, absurdity, or playful observation.'
    WHEN 'Insightful' THEN 'Reveals a fresh perspective or a deeper understanding.'
    WHEN 'Comforting' THEN 'Offers reassurance, empathy, or consolation in difficult times.'
    WHEN 'Cautionary' THEN 'Warns of risks, consequences, or mistakes to avoid.'
    WHEN 'Cynical' THEN 'Expresses distrust of motives, institutions, or human sincerity.'
    WHEN 'Provocative' THEN 'Challenges assumptions or invites debate and reflection.'
END;

UPDATE themes SET description = CASE name
    WHEN 'Life & death' THEN 'Living, mortality, and the human condition.'
    WHEN 'Love & connection' THEN 'Romance, friendship, family, belonging, and relationships.'
    WHEN 'Success & failure' THEN 'Achievement, defeat, mistakes, and responses to outcomes.'
    WHEN 'Work & ambition' THEN 'Effort, vocation, goals, and the drive to achieve.'
    WHEN 'Wisdom & learning' THEN 'Knowledge, experience, education, and understanding.'
    WHEN 'Courage & resolve' THEN 'Bravery, persistence, resilience, and facing adversity.'
    WHEN 'Joy & meaning' THEN 'Happiness, fulfillment, purpose, and what makes life worthwhile.'
    WHEN 'Time & change' THEN 'Aging, impermanence, growth, and the passage of time.'
    WHEN 'Society & power' THEN 'Politics, justice, leadership, freedom, and social structures.'
    WHEN 'Art & beauty' THEN 'Creativity, expression, aesthetics, and appreciation of beauty.'
    WHEN 'Faith & belief' THEN 'Religion, spirituality, and philosophical beliefs.'
    WHEN 'Human nature' THEN 'Character, ego, habits, motives, and human contradictions.'
END;

UPDATE forms SET description = CASE name
    WHEN 'Aphorism' THEN 'A concise, memorable observation or statement of a general truth.'
    WHEN 'Paradox' THEN 'An apparent contradiction that reveals an unexpected idea or truth.'
    WHEN 'Metaphor' THEN 'Expresses an idea through comparison or analogy, literal or figurative.'
    WHEN 'Retort' THEN 'A pointed reply or witty comeback to another remark.'
    WHEN 'Advice' THEN 'A recommendation, instruction, or imperative suggesting how to act.'
    WHEN 'Verse' THEN 'Language built around poetic structure, rhythm, or meter; may come from a poem, play, or song.'
END;

UPDATE sources SET description = CASE name
    WHEN 'Movie' THEN 'Dialogue or narration from a film.'
    WHEN 'Speech' THEN 'An address, lecture, sermon, toast, or other prepared spoken presentation.'
    WHEN 'Play' THEN 'Dialogue or a monologue from a work written for the stage.'
    WHEN 'Letter' THEN 'A letter or personal correspondence.'
    WHEN 'Book' THEN 'A published book, including fiction, nonfiction, and religious texts.'
    WHEN 'Article' THEN 'An article, essay, or blog post.'
    WHEN 'Poem' THEN 'A poem; use Verse as the form when its poetic construction is relevant.'
    WHEN 'Song' THEN 'Lyrics from a song.'
    WHEN 'Interview' THEN 'A published or recorded interview or question-and-answer exchange.'
    WHEN 'Conversation' THEN 'An informal remark or exchange, rather than a prepared speech or interview.'
    WHEN 'Journal' THEN 'A diary, journal, or personal notebook.'
END;

ALTER TABLE tones MODIFY COLUMN description VARCHAR(255) NOT NULL;
ALTER TABLE themes MODIFY COLUMN description VARCHAR(255) NOT NULL;
ALTER TABLE forms MODIFY COLUMN description VARCHAR(255) NOT NULL;
ALTER TABLE sources MODIFY COLUMN description VARCHAR(255) NOT NULL;
