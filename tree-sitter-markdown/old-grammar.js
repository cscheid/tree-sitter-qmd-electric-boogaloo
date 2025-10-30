// This grammar only concerns the block structure according to the CommonMark Spec
// (https://spec.commonmark.org/0.30/#blocks-and-inlines)
// For more information see README.md

/// <reference types="tree-sitter-cli/dsl" />

const common = require('../common/common');

const PRECEDENCE_LEVEL_LINK = common.PRECEDENCE_LEVEL_LINK;

const PUNCTUATION_CHARACTERS_REGEX = '!-/:-@\\[-`\\{-~';

module.exports = grammar({
    name: 'markdown',

    rules: {
        document: $ => seq(
            optional(choice(
                $.minus_metadata,
                common.EXTENSION_PLUS_METADATA ? $.plus_metadata : choice(),
            )),
            alias(prec.right(repeat($._block_not_section)), $.section),
            repeat($.section),
        ),

        // ...common.rules,
        _last_token_punctuation: $ => choice(), // needed for compatibility with common rules

        _qmd_attribute: common.rules._qmd_attribute,
        language_attribute: common.rules.language_attribute,
        raw_attribute: common.rules.raw_attribute,
        commonmark_attribute: common.rules.commonmark_attribute,
        commonmark_name: common.rules.commonmark_name,
        _commonmark_whitespace: common.rules._commonmark_whitespace,
        id_specifier: common.rules.id_specifier,
        class_specifier: common.rules.class_specifier,
        _attribute: common.rules._attribute,
        key_value_key: common.rules.key_value_key,
        key_value_value: common.rules.key_value_value,
        _backslash_escape: common.rules._backslash_escape,

        // BLOCK STRUCTURE

        // All blocks. Every block contains a trailing newline.
        _block: $ => choice(
            $._block_not_section,
            $.section,
        ),
        _block_not_section: $ => choice(
            alias($._setext_heading1, $.setext_heading),
            alias($._setext_heading2, $.setext_heading),
            $.paragraph,
            $.inline_ref_def,
            $.note_definition_fenced_block,
            $.indented_code_block,
            $.block_quote,
            $.thematic_break,
            $.list,
            $.fenced_code_block,
            $.fenced_div_block,
            $._blank_line,
            $.pipe_table,
            $.caption,
            prec(-1, $.minus_metadata),
        ),
        section: $ => choice($._section1, $._section2, $._section3, $._section4, $._section5, $._section6),
        _section1: $ => prec.right(seq(
            alias($._atx_heading1, $.atx_heading),
            repeat(choice(
                alias(choice($._section6, $._section5, $._section4, $._section3, $._section2), $.section),
                $._block_not_section
            ))
        )),
        _section2: $ => prec.right(seq(
            alias($._atx_heading2, $.atx_heading),
            repeat(choice(
                alias(choice($._section6, $._section5, $._section4, $._section3), $.section),
                $._block_not_section
            ))
        )),
        _section3: $ => prec.right(seq(
            alias($._atx_heading3, $.atx_heading),
            repeat(choice(
                alias(choice($._section6, $._section5, $._section4), $.section),
                $._block_not_section
            ))
        )),
        _section4: $ => prec.right(seq(
            alias($._atx_heading4, $.atx_heading),
            repeat(choice(
                alias(choice($._section6, $._section5), $.section),
                $._block_not_section
            ))
        )),
        _section5: $ => prec.right(seq(
            alias($._atx_heading5, $.atx_heading),
            repeat(choice(
                alias($._section6, $.section),
                $._block_not_section
            ))
        )),
        _section6: $ => prec.right(seq(
            alias($._atx_heading6, $.atx_heading),
            repeat($._block_not_section)
        )),

        // LEAF BLOCKS

        // A thematic break. This is currently handled by the external scanner but maybe could be
        // parsed using normal tree-sitter rules.
        //
        // https://github.github.com/gfm/#thematic-breaks
        thematic_break: $ => seq($._thematic_break, choice($._newline, $._eof)),

        // An ATX heading. This is currently handled by the external scanner but maybe could be
        // parsed using normal tree-sitter rules.
        //
        // https://github.github.com/gfm/#atx-headings
        _atx_heading1: $ => prec(1, seq(
            $.atx_h1_marker,
            optional($._atx_heading_content),
            optional(alias($._qmd_attribute, $.attribute)),
            $._newline
        )),
        _atx_heading2: $ => prec(1, seq(
            $.atx_h2_marker,
            optional($._atx_heading_content),
            optional(alias($._qmd_attribute, $.attribute)),
            $._newline
        )),
        _atx_heading3: $ => prec(1, seq(
            $.atx_h3_marker,
            optional($._atx_heading_content),
            optional(alias($._qmd_attribute, $.attribute)),
            $._newline
        )),
        _atx_heading4: $ => prec(1, seq(
            $.atx_h4_marker,
            optional($._atx_heading_content),
            optional(alias($._qmd_attribute, $.attribute)),
            $._newline
        )),
        _atx_heading5: $ => prec(1, seq(
            $.atx_h5_marker,
            optional($._atx_heading_content),
            optional(alias($._qmd_attribute, $.attribute)),
            $._newline
        )),
        _atx_heading6: $ => prec(1, seq(
            $.atx_h6_marker,
            optional($._atx_heading_content),
            optional(alias($._qmd_attribute, $.attribute)),
            $._newline
        )),
        _atx_heading_content: $ => prec(1, seq(
            optional($._whitespace),
            field('heading_content', alias($._atx_heading_line, $.inline))
        )),

        // A setext heading. The underlines are currently handled by the external scanner but maybe
        // could be parsed using normal tree-sitter rules.
        //
        // https://github.github.com/gfm/#setext-headings
        _setext_heading1: $ => seq(
            field('heading_content', $.paragraph),
            $.setext_h1_underline,
            choice($._newline, $._eof),
        ),
        _setext_heading2: $ => seq(
            field('heading_content', $.paragraph),
            $.setext_h2_underline,
            choice($._newline, $._eof),
        ),

        // An indented code block. An indented code block is made up of indented chunks and blank
        // lines. The indented chunks are handeled by the external scanner.
        //
        // https://github.github.com/gfm/#indented-code-blocks
        indented_code_block: $ => prec.right(seq($._indented_chunk, repeat(choice($._indented_chunk, $._blank_line)))),
        _indented_chunk: $ => seq($._indented_chunk_start, repeat(choice($._code_line, $._newline)), $._block_close, optional($.block_continuation)),

        fenced_div_block: $ => seq(
          $._fenced_div_start,
          $._whitespace,
          choice($.info_string, $._qmd_attribute, "{}"),
          $._newline,
          repeat($._block),
          optional(seq($._fenced_div_end, $._close_block, choice($._newline, $._eof))),
          $._block_close,
        ),
        // A fenced code block. Fenced code blocks are mainly handled by the external scanner. In
        // case of backtick code blocks the external scanner also checks that the info string is
        // proper.
        //
        // https://github.github.com/gfm/#fenced-code-blocks
        fenced_code_block: $ => prec.right(choice(
            seq(
                alias($._fenced_code_block_start_backtick, $.fenced_code_block_delimiter),
                optional($._whitespace),
                optional(choice($.info_string, $._qmd_attribute)),
                $._newline,
                optional($.code_fence_content),
                optional(seq(alias($._fenced_code_block_end_backtick, $.fenced_code_block_delimiter), $._close_block, $._newline)),
                $._block_close,
            ),
            seq(
                alias($._fenced_code_block_start_tilde, $.fenced_code_block_delimiter),
                optional($._whitespace),
                optional(choice($.info_string, $._qmd_attribute)),
                $._newline,
                optional($.code_fence_content),
                optional(seq(alias($._fenced_code_block_end_tilde, $.fenced_code_block_delimiter), $._close_block, $._newline)),
                $._block_close,
            ),
        )),
        code_fence_content: $ => repeat1(choice($._newline, $._code_line)),

        // QMD CHANGES
        // we support a stricter set of infostrings, namely the ones that Pandoc appears to support
        // We do not allow curly braces in the content of the infostring (which pandoc does)
        // We also don't allow starting with ^ (reserved for note definitions)
        // https://pandoc.org/MANUAL.html#extension-fenced_code_attributes

        info_string: $ => alias(/[^{}\s^][^{}\s]*/, $.language),
        // language: $ => prec.right(repeat1(choice($._word, common.punctuation_without($, ['{', '}', ',']), $.backslash_escape, $.entity_reference, $.numeric_character_reference))),

        // A paragraph. The parsing tactic for deciding when a paragraph ends is as follows:
        // on every newline inside a paragraph a conflict is triggered manually using
        // `$._split_token` to split the parse state into two branches.
        //
        // One of them - the one that also contains a `$._soft_line_break_marker` will try to
        // continue the paragraph, but we make sure that the beginning of a new block that can
        // interrupt a paragraph can also be parsed. If this is the case we know that the paragraph
        // should have been closed and the external parser will emit an `$._error` to kill the parse
        // branch.
        //
        // The other parse branch consideres the paragraph to be over. It will be killed if no valid new
        // block is detected before the next newline. (For example it will also be killed if a indented
        // code block is detected, which cannot interrupt paragraphs).
        //
        // Either way, after the next newline only one branch will exist, so the ammount of branches
        // related to paragraphs ending does not grow.
        //
        // https://github.github.com/gfm/#paragraphs
        paragraph: $ => seq(alias(repeat1(choice($._line, $._soft_line_break)), $.inline), choice($._newline, $._eof)),

        inline_ref_def: $ => seq(
            $.ref_id_specifier,
            $._whitespace,
            $.paragraph),

        note_definition_fenced_block: $ => seq(
            $._fenced_div_start,
            $._whitespace,
            $.fenced_div_note_id,
            $._newline,
            repeat($._block),
            optional(seq($._fenced_div_end, $._close_block, choice($._newline, $._eof))),
            $._block_close,
        ),

        // A blank line including the following newline.
        //
        // https://github.github.com/gfm/#blank-lines
        _blank_line: $ => seq($._blank_line_start, choice($._newline, $._eof)),

        // A caption block: blank line followed by ": caption text"
        // Used for table captions (and potentially other elements)
        // Note: This matches a SINGLE colon only, not multiple colons (which would be fenced divs)
        caption: $ => prec.right(seq(
            $._blank_line,
            ':',
            optional(seq(
                $._whitespace,
                alias($._caption_line, $.inline)
            )),
            choice($._newline, $._eof),
        )),

        // Caption line content - similar to _line but doesn't start with whitespace
        _caption_line: $ => prec.right(seq(
            choice($._word, $._display_math_state_track_marker, $._inline_math_state_track_marker, $._html_comment, common.punctuation_without($, [])),
            repeat(choice($._word, $._display_math_state_track_marker, $._inline_math_state_track_marker, $._whitespace, $._html_comment, common.punctuation_without($, [])))
        )),


        // CONTAINER BLOCKS

        // A block quote. This is the most basic example of a container block handled by the
        // external scanner.
        //
        // https://github.github.com/gfm/#block-quotes
        block_quote: $ => seq(
            alias($._block_quote_start, $.block_quote_marker),
            optional($.block_continuation),
            repeat($._block),
            $._block_close,
            optional($.block_continuation)
        ),

        // A list. This grammar does not differentiate between loose and tight lists for efficiency
        // reasons.
        //
        // Lists can only contain list items with list markers of the same type. List items are
        // handled by the external scanner.
        //
        // https://github.github.com/gfm/#lists
        list: $ => prec.right(choice(
            $._list_plus,
            $._list_minus,
            $._list_star,
            $._list_dot,
            $._list_parenthesis,
            $._list_example
        )),
        _list_plus: $ => prec.right(repeat1(alias($._list_item_plus, $.list_item))),
        _list_minus: $ => prec.right(repeat1(alias($._list_item_minus, $.list_item))),
        _list_star: $ => prec.right(repeat1(alias($._list_item_star, $.list_item))),
        _list_dot: $ => prec.right(repeat1(alias($._list_item_dot, $.list_item))),
        _list_parenthesis: $ => prec.right(repeat1(alias($._list_item_parenthesis, $.list_item))),
        _list_example: $ => prec.right(repeat1(alias($._list_item_example, $.list_item))),
        // Some list items can not interrupt a paragraph and are marked as such by the external
        // scanner.
        list_marker_plus: $ => choice($._list_marker_plus, $._list_marker_plus_dont_interrupt),
        list_marker_minus: $ => choice($._list_marker_minus, $._list_marker_minus_dont_interrupt),
        list_marker_star: $ => choice($._list_marker_star, $._list_marker_star_dont_interrupt),
        list_marker_dot: $ => choice($._list_marker_dot, $._list_marker_dot_dont_interrupt),
        list_marker_parenthesis: $ => choice($._list_marker_parenthesis, $._list_marker_parenthesis_dont_interrupt),
        list_marker_example: $ => choice($._list_marker_example, $._list_marker_example_dont_interrupt),
        _list_item_plus: $ => seq(
            $.list_marker_plus,
            optional($.block_continuation),
            $._list_item_content,
            $._block_close,
            optional($.block_continuation)
        ),
        _list_item_minus: $ => seq(
            $.list_marker_minus,
            optional($.block_continuation),
            $._list_item_content,
            $._block_close,
            optional($.block_continuation)
        ),
        _list_item_star: $ => seq(
            $.list_marker_star,
            optional($.block_continuation),
            $._list_item_content,
            $._block_close,
            optional($.block_continuation)
        ),
        _list_item_dot: $ => seq(
            $.list_marker_dot,
            optional($.block_continuation),
            $._list_item_content,
            $._block_close,
            optional($.block_continuation)
        ),
        _list_item_parenthesis: $ => seq(
            $.list_marker_parenthesis,
            optional($.block_continuation),
            $._list_item_content,
            $._block_close,
            optional($.block_continuation)
        ),
        _list_item_example: $ => seq(
            $.list_marker_example,
            optional($.block_continuation),
            $._list_item_content,
            $._block_close,
            optional($.block_continuation)
        ),
        // List items are closed after two consecutive blank lines
        _list_item_content: $ => choice(
            prec(1, seq(
                $._blank_line,
                $._blank_line,
                $._close_block,
                optional($.block_continuation)
            )),
            repeat1($._block),
            common.EXTENSION_TASK_LIST ? prec(1, seq(
                choice($.task_list_marker_checked, $.task_list_marker_unchecked),
                $._whitespace,
                $.paragraph,
                repeat($._block)
            )) : choice()
        ),

        // Newlines as in the spec. Parsing a newline triggers the matching process by making
        // the external parser emit a `$._line_ending`.
        _newline: $ => seq(
            $._line_ending,
            optional($.block_continuation)
        ),
        _soft_line_break: $ => seq(
            $._soft_line_ending,
            optional($.block_continuation)
        ),
        // Some symbols get parsed as single tokens so that html blocks get detected properly
        _code_line:        $ => prec.right(repeat1(choice($._word, '<', '>', '{{<', '}}>', $._display_math_state_track_marker, $._inline_math_state_track_marker, $._whitespace, $._html_comment, common.punctuation_without($, [])))),

        // the gymnastics around `:` in _line exist to make the parser reject paragraphs that start with a colon.
        // Those are technically valid in Markdown, but disallowing them here makes it possible to detect an
        // accidentally-continued paragraph with a colon that should have been a fenced div marker.
        // In these cases, users can use \: to escape the first colon.

        _regular_block_content: $ => choice(
            $._word, 
            $._display_math_state_track_marker, 
            $._inline_math_state_track_marker, 
            $._whitespace, 
            $._html_comment,
            $.raw_specifier,
            $._autolink,
            $._escaped_characters,
            $._pipe_table_code_span,
            '{{<', '>}}', // shortcodes
            '[>>', // this needs to be accepted for highlights in editorial comments
        ),

        _escaped_characters: $ => /\\./,
        _line:             $ => prec.right(seq(prec.right(choice(       $._regular_block_content, common.punctuation_without($, [":"]))),
                                               prec.right(repeat(choice($._regular_block_content, common.punctuation_without($, [])))))),
        _atx_heading_line: $ => prec.right(repeat1(choice($._regular_block_content, common.punctuation_without($, [])))),
        _word: $ => new RegExp('[^' + PUNCTUATION_CHARACTERS_REGEX + ' \\t\\n\\r]+'),
        // The external scanner emits some characters that should just be ignored.
        _whitespace: $ => /[ \t]+/,

        ...(common.EXTENSION_PIPE_TABLE ? {
            pipe_table: $ => prec.right(seq(
                $._pipe_table_start,
                alias($.pipe_table_row, $.pipe_table_header),
                $._newline,
                $.pipe_table_delimiter_row,
                repeat(seq($._pipe_table_newline, optional($.pipe_table_row))),
                choice($._newline, $._eof),
            )),

            _pipe_table_newline: $ => seq(
                $._pipe_table_line_ending,
                optional($.block_continuation)
            ),

            pipe_table_delimiter_row: $ => seq(
                optional(seq(
                    optional($._whitespace),
                    '|',
                )),
                repeat1(prec.right(seq(
                    optional($._whitespace),
                    $.pipe_table_delimiter_cell,
                    optional($._whitespace),
                    '|',
                ))),
                optional($._whitespace),
                optional(seq(
                    $.pipe_table_delimiter_cell,
                    optional($._whitespace)
                )),
            ),

            pipe_table_delimiter_cell: $ => seq(
                optional(alias(':', $.pipe_table_align_left)),
                repeat1('-'),
                optional(alias(':', $.pipe_table_align_right)),
            ),

            pipe_table_row: $ => seq(
                optional(seq(
                    optional($._whitespace),
                    '|',
                )),
                choice(
                    seq(
                        repeat1(prec.right(seq(
                            choice(
                                seq(
                                    optional($._whitespace),
                                    $.pipe_table_cell,
                                    optional($._whitespace)
                                ),
                                alias($._whitespace, $.pipe_table_cell)
                            ),
                            '|',
                        ))),
                        optional($._whitespace),
                        optional(seq(
                            $.pipe_table_cell,
                            optional($._whitespace)
                        )),
                    ),
                    seq(
                        optional($._whitespace),
                        $.pipe_table_cell,
                        optional($._whitespace)
                    )
                ),
            ),

            // Code span within pipe table cells - simplified version that only handles backticks
            _pipe_table_code_span: $ => seq(
                $._code_span_start,
                repeat(choice(
                    $._word,
                    $._whitespace,
                    '>', '<',
                    common.punctuation_without($, []),
                )),
                $._code_span_close,
            ),

            // Latex span within pipe table cells - simplified version that only handles dollar signs
            _pipe_table_latex_span: $ => seq(
                $._latex_span_start,
                repeat(choice(
                    $._word,
                    $._whitespace,
                    '>', '<',
                    common.punctuation_without($, []),
                )),
                $._latex_span_close,
            ),

            _pipe_table_cell_contents: $ => prec.right(
                seq(
                    choice(
                        $._word,
                        $._display_math_state_track_marker,
                        $._inline_math_state_track_marker,
                        $._backslash_escape,
                        $._pipe_table_code_span,
                        $._pipe_table_latex_span,
                        common.punctuation_without($, ['|']),
                    ),
                    repeat(choice(
                        $._word,
                        $._display_math_state_track_marker,
                        $._inline_math_state_track_marker,
                        $._whitespace,
                        $._backslash_escape,
                        $._pipe_table_code_span,
                        $._pipe_table_latex_span,
                        common.punctuation_without($, ['|']),
                    )))),

            pipe_table_cell: $ => alias($._pipe_table_cell_contents, $.inline),
        } : {}),
    },

    externals: $ => [
        // QMD CHANGES NOTE:
        // Do not change anything here, even if these external tokens are not used in the grammar.
        // they need to match the external c scanner.
        // 
        // Quite a few of these tokens could maybe be implemented without use of the external parser.
        // For this the `$._open_block` and `$._close_block` tokens should be used to tell the external
        // parser to put a new anonymous block on the block stack.

        // Block structure gets parsed as follows: After every newline (`$._line_ending`) we try to match
        // as many open blocks as possible. For example if the last line was part of a block quote we look
        // for a `>` at the beginning of the next line. We emit a `$.block_continuation` for each matched
        // block. For this process the external scanner keeps a stack of currently open blocks.
        //
        // If we are not able to match all blocks that does not necessarily mean that all unmatched blocks
        // have to be closed. It could also mean that the line is a lazy continuation line
        // (https://github.github.com/gfm/#lazy-continuation-line, see also `$._split_token` and
        // `$._soft_line_break_marker` below)
        //
        // If a block does get closed (because it was not matched or because some closing token was
        // encountered) we emit a `$._block_close` token

        $._line_ending, // this token does not contain the actual newline characters. see `$._newline`
        $._soft_line_ending,
        $._block_close,
        $.block_continuation,

        // Tokens signifying the start of a block. Blocks that do not need a `$._block_close` because they
        // always span one line are marked as such.

        $._block_quote_start,
        $._indented_chunk_start,
        $.atx_h1_marker, // atx headings do not need a `$._block_close`
        $.atx_h2_marker,
        $.atx_h3_marker,
        $.atx_h4_marker,
        $.atx_h5_marker,
        $.atx_h6_marker,
        $.setext_h1_underline, // setext headings do not need a `$._block_close`
        $.setext_h2_underline,
        $._thematic_break, // thematic breaks do not need a `$._block_close`
        $._list_marker_minus,
        $._list_marker_plus,
        $._list_marker_star,
        $._list_marker_parenthesis,
        $._list_marker_dot,
        $._list_marker_minus_dont_interrupt, // list items that do not interrupt an ongoing paragraph
        $._list_marker_plus_dont_interrupt,
        $._list_marker_star_dont_interrupt,
        $._list_marker_parenthesis_dont_interrupt,
        $._list_marker_dot_dont_interrupt,
        $._list_marker_example,
        $._list_marker_example_dont_interrupt,
        $._fenced_code_block_start_backtick,
        $._fenced_code_block_start_tilde,
        $._blank_line_start, // Does not contain the newline characters. Blank lines do not need a `$._block_close`

        // Special tokens for block structure

        // Closing backticks or tildas for a fenced code block. They are used to trigger a `$._close_block`
        // which in turn will trigger a `$._block_close` at the beginning the following line.
        $._fenced_code_block_end_backtick,
        $._fenced_code_block_end_tilde,

        // Similarly this is used if the closing of a block is not decided by the external parser.
        // A `$._block_close` will be emitted at the beginning of the next line. Notice that a
        // `$._block_close` can also get emitted if the parent block closes.
        $._close_block,

        // This is a workaround so the external parser does not try to open indented blocks when
        // parsing a link reference definition.
        $._no_indented_chunk,

        // An `$._error` token is never valid  and gets emmited to kill invalid parse branches. Concretely
        // this is used to decide wether a newline closes a paragraph and together and it gets emitted
        // when trying to parse the `$._trigger_error` token in `$.link_title`.
        $._error,
        $._trigger_error,
        $._eof,

        $.minus_metadata,
        $.plus_metadata,

        $._pipe_table_start,
        $._pipe_table_line_ending,

        $._fenced_div_start,
        $._fenced_div_end,

        $.ref_id_specifier,
        $.fenced_div_note_id,

        // special tokens to allow external scanner serialization to happen
        $._display_math_state_track_marker,
        $._inline_math_state_track_marker,

        // code span delimiters for parsing pipe table cells
        $._code_span_start,
        $._code_span_close,

        // latex span delimiters for parsing pipe table cells
        $._latex_span_start,
        $._latex_span_close,

        // HTML comment token
        $._html_comment,

        // raw specifiers
        $.raw_specifier, // no leading underscore because it is needed in common.js without it.

        // autolinks
        $._autolink
    ],
    precedences: $ => [
        [$._setext_heading1, $._block],
        [$._setext_heading2, $._block],
        [$.indented_code_block, $._block],
    ],
    conflicts: $ => [
        [$.language_attribute, $._atx_heading_line],
    ],
    extras: $ => [],
});