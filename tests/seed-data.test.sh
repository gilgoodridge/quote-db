#!/bin/bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -f "$WORK/curl" "$WORK/requests" "$WORK/output"; rmdir "$WORK"' EXIT
export SEED_TEST_REQUESTS="$WORK/requests"

cat > "$WORK/curl" <<'MOCK'
#!/bin/bash
set -euo pipefail
url="" body=""
while (( $# )); do
    case "$1" in
        -d) body="$2"; shift 2 ;;
        http*) url="$1"; shift ;;
        *) shift ;;
    esac
done
case "$url" in
    */auth/csrf) printf '{"token":"test-token","headerName":"X-CSRF-TOKEN"}' ;;
    */categories)
        jq -n '
            def options: to_entries | map({id: (.key + 101), name: .value});
            {
                tones: (["Inspirational","Funny","Insightful","Comforting","Cautionary","Cynical","Provocative"] | options),
                themes: (["Life & death","Love & connection","Success & failure","Work & ambition",
                    "Wisdom & learning","Courage & resolve","Joy & meaning","Time & change",
                    "Society & power","Art & beauty","Faith & belief","Human nature"] | options),
                forms: (["Aphorism","Paradox","Metaphor","Retort","Advice","Verse"] | options),
                sources: (["Movie","Speech","Play","Letter","Book","Article","Poem","Song",
                    "Interview","Conversation","Journal"] | options)
            }'
        ;;
    */authors|*/characters|*/quotes)
        jq -cn --arg url "$url" --argjson body "$body" '{url: $url, body: $body}' >> "$SEED_TEST_REQUESTS"
        if [[ "$url" == */characters && "${SEED_TEST_FAIL_CHARACTER:-}" == "yes" ]]; then
            printf 'Character creation failed\n500'
        else
            id=$(wc -l < "$SEED_TEST_REQUESTS")
            printf '{"id":%s}\n200' "$((id + 400))"
        fi
        ;;
    *) echo "Unexpected request: $url" >&2; exit 1 ;;
esac
MOCK
chmod +x "$WORK/curl"

printf 'test-session\n' | PATH="$WORK:$PATH" bash "$ROOT/seed-data.sh" http://seed.test > "$WORK/output"
jq -se '
    def endpoint($name): map(select(.url | endswith("/" + $name)));
    endpoint("authors") as $authors |
    endpoint("characters") as $characters |
    endpoint("quotes") as $quotes |
    ($authors | length == 7) and
    ($characters | length == 2) and
    ($quotes | length == 20) and
    ($characters[0].body == {
        fullName: "Hamlet", knownAs: "Prince Hamlet",
        description: "Prince of Denmark, son of the late King Hamlet.", workTitle: "Hamlet"
    }) and
    ($characters[1].body.fullName == "Jaques") and
    ($characters[1].body.workTitle == "As You Like It") and
    ($quotes | map(select(.body.characterId != null)) | length == 2) and
    ($quotes | map(select(.body.location == "Hamlet")) |
        length == 1 and .[0].body.characterId == 408 and .[0].body.authorId == 406 and
        .[0].body.text == "To be, or not to be, that is the question." and
        .[0].body.sourceIds == [103]) and
    ($quotes | map(select(.body.location == "As You Like It")) |
        length == 1 and .[0].body.characterId == 409 and .[0].body.authorId == 406) and
    ($quotes | map(select(.body.location == "Pride and Prejudice")) |
        length == 1 and (.[0].body | has("characterId") | not))
' "$WORK/requests" > /dev/null

: > "$WORK/requests"
if printf 'test-session\n' | PATH="$WORK:$PATH" SEED_TEST_FAIL_CHARACTER=yes \
    bash "$ROOT/seed-data.sh" http://seed.test > "$WORK/output" 2>&1; then
    echo "Expected character creation failure to stop seeding." >&2
    exit 1
fi
jq -se 'length == 8 and all(.[]; (.url | endswith("/quotes") | not))' \
    "$WORK/requests" > /dev/null
grep -q 'Error creating character Hamlet' "$WORK/output"
echo "Seed character associations and failure handling passed."
