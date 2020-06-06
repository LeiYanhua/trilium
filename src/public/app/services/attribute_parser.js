function preprocess(str) {
    if (str.startsWith('<p>')) {
        str = str.substr(3);
    }

    if (str.endsWith('</p>')) {
        str = str.substr(0, str.length - 4);
    }

    str = str.replace("&nbsp;", " ");

    return str.replace(/<a[^>]+href="(#[A-Za-z0-9/]*)"[^>]*>[^<]*<\/a>/g, "$1");
}

function lexer(str) {
    str = preprocess(str);

    const tokens = [];

    let quotes = false;
    let currentWord = '';

    function isOperatorSymbol(chr) {
        return ['=', '*', '>', '<', '!'].includes(chr);
    }

    function previousOperatorSymbol() {
        if (currentWord.length === 0) {
            return false;
        }
        else {
            return isOperatorSymbol(currentWord[currentWord.length - 1]);
        }
    }

    /**
     * @param endIndex - index of the last character of the token
     */
    function finishWord(endIndex) {
        if (currentWord === '') {
            return;
        }

        tokens.push({
            text: currentWord,
            startIndex: endIndex - currentWord.length,
            endIndex: endIndex
        });

        currentWord = '';
    }

    for (let i = 0; i < str.length; i++) {
        const chr = str[i];

        if (chr === '\\') {
            if ((i + 1) < str.length) {
                i++;

                currentWord += str[i];
            }
            else {
                currentWord += chr;
            }

            continue;
        }
        else if (['"', "'", '`'].includes(chr)) {
            if (!quotes) {
                if (previousOperatorSymbol()) {
                    finishWord(i - 1);
                }

                quotes = chr;
            }
            else if (quotes === chr) {
                quotes = false;

                finishWord(i - 1);
            }
            else {
                // it's a quote but within other kind of quotes so it's valid as a literal character
                currentWord += chr;
            }
            continue;
        }
        else if (!quotes) {
            if (currentWord.length === 0 && (chr === '#' || chr === '~')) {
                currentWord = chr;

                continue;
            }
            else if (chr === ' ') {
                finishWord(i - 1);
                continue;
            }
            else if (previousOperatorSymbol() !== isOperatorSymbol(chr)) {
                finishWord(i - 1);

                currentWord += chr;
                continue;
            }
        }

        currentWord += chr;
    }

    finishWord(str.length - 1);

    return tokens;
}

function parser(tokens) {
    const attrs = [];

    for (let i = 0; i < tokens.length; i++) {
        const {text, startIndex, endIndex} = tokens[i];

        if (text.startsWith('#')) {
            const attr = {
                type: 'label',
                name: text.substr(1),
                isInheritable: false, // FIXME
                startIndex,
                endIndex
            };

            if (i + 1 < tokens.length && tokens[i + 1].text === "=") {
                if (i + 2 >= tokens.length) {
                    throw new Error(`Missing value for label "${text}"`);
                }

                i += 2;

                attr.value = tokens[i].text;
            }

            attrs.push(attr);
        }
        else if (text.startsWith('~')) {
            if (i + 2 >= tokens.length || tokens[i + 1].text !== '=') {
                throw new Error(`Relation "${text}" should point to a note.`);
            }

            i += 2;

            let notePath = tokens[i].text;
            if (notePath.startsWith("#")) {
                notePath = notePath.substr(1);
            }

            const noteId = notePath.split('/').pop();

            const attr = {
                type: 'relation',
                name: text.substr(1),
                isInheritable: false, // FIXME
                value: noteId,
                startIndex,
                endIndex
            };

            attrs.push(attr);
        }
        else {
            throw new Error(`Unrecognized attribute "${text}"`);
        }
    }

    return attrs;
}

function lexAndParse(str) {
    const tokens = lexer(str);

    return parser(tokens);
}

export default {
    lexer,
    parser,
    lexAndParse
}
