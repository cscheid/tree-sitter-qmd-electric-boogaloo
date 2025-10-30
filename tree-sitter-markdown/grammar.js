module.exports = grammar({
    name: 'markdown',

    rules: {
        ///////////////////////////////////////////////////////////////////////////////////////////
        // document

        document: $ => seq(
            optional(alias($.minus_metadata, $.metadata)),
            alias(prec.right(repeat($._block_not_section)), $.section),
            repeat($.section),
        ),

        ///////////////////////////////////////////////////////////////////////////////////////////
        // BLOCK STRUCTURE

        // All blocks. Every block contains a trailing newline.
        _block: $ => choice(
            $._block_not_section,
            $.section,
        ),
        _block_not_section: $ => prec.right(choice(
            $.pandoc_paragraph,
            $.pandoc_block_quote,
            $.pandoc_list,
            $.pandoc_code_block,
            $.pandoc_div,
            $.pandoc_horizontal_rule,

            prec(-1, alias($.minus_metadata, $.metadata)),

            $.note_definition_fenced_block,
            $.inline_ref_def,

            $._soft_line_break,
            $._newline
        )),
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

        ///////////////////////////////////////////////////////////////////////////////////////////
        // LEAF BLOCKS

        // An ATX heading. This is currently handled by the external scanner but maybe could be
        // parsed using normal tree-sitter rules.
        //
        // https://github.github.com/gfm/#atx-headings
        _atx_heading1: $ => prec(1, seq(
            $.atx_h1_marker,
            optional($._atx_heading_content),
            $._newline
        )),
        _atx_heading2: $ => prec(1, seq(
            $.atx_h2_marker,
            optional($._atx_heading_content),
            $._newline
        )),
        _atx_heading3: $ => prec(1, seq(
            $.atx_h3_marker,
            optional($._atx_heading_content),
            $._newline
        )),
        _atx_heading4: $ => prec(1, seq(
            $.atx_h4_marker,
            optional($._atx_heading_content),
            $._newline
        )),
        _atx_heading5: $ => prec(1, seq(
            $.atx_h5_marker,
            optional($._atx_heading_content),
            $._newline
        )),
        _atx_heading6: $ => prec(1, seq(
            $.atx_h6_marker,
            optional($._atx_heading_content),
            $._newline
        )),
        _atx_heading_content: $ => prec(1, seq(
            optional($._whitespace),
            $._inlines, 
            choice($._newline, $._eof)
        )),
        pandoc_horizontal_rule: $ => seq($._thematic_break, choice($._newline, $._eof)),

        pandoc_paragraph: $ => seq(
            $._inlines, 
            choice($._newline, $._eof)
        ),

        inline_ref_def: $ => seq(
            $.ref_id_specifier,
            $._whitespace,
            $.pandoc_paragraph),
        
        ///////////////////////////////////////////////////////////////////////////////////////////
        // inline nodes

        _inlines: $ => seq(
            $._line,
            repeat(seq(alias($._soft_line_break, $.pandoc_soft_break), $._line))
        ),


        pandoc_span: $ => prec.right(seq(
            '[',
            optional(alias($._inlines, $.content)),
            choice(
                $.target,
                ']',
            ),
            optional($.attribute_specifier)
        )),

        pandoc_image: $ => prec.right(seq(
            '![',
            optional(alias($._inlines, $.content)),
            choice(
                $.target,
                ']',
            ),
            optional($.attribute_specifier)
        )),

        target: $ => seq(
            '](', 
            alias(/[^ \t)]+/, $.url),
            optional(seq($._inline_whitespace, alias($._commonmark_double_quote_string, $.title))),
            ')'
        ),

        pandoc_math: $ => seq(
            '$',
            /[^$ \t\n]([ \t]?[^$ \t\n]+)*/,
            '$',
        ),

        pandoc_display_math: $ => seq(
            '$$',
            /[^$]+/,
            '$$'
        ),

        pandoc_code_span: $ => prec.right(seq(
            alias($._code_span_start, $.code_span_delimiter),
            // this is a goofy construction but it lets the external scanner in to 
            // do add the code_span_code token
            alias(repeat1(choice(
                    /[^`]+/,
                    /[`]/
                )), $.content),
            alias($._code_span_close, $.code_span_delimiter),
            optional($.attribute_specifier)
        )),
        
        attribute_specifier: $ => seq(
            '{',
            optional(choice(
                $.raw_specifier,
                $.language_specifier,
                $.commonmark_specifier,
                alias($._commonmark_specifier_start_with_class, $.commonmark_specifier),
                alias($._commonmark_specifier_start_with_kv, $.commonmark_specifier)
            )),
            '}'
        ),

        language_specifier: $ => choice(
            $._language_specifier_token,
            seq('{', $.language_specifier, '}')
        ),

        commonmark_specifier: $ => seq(
            optional($._inline_whitespace),
            alias(/[#][A-Za-z][A-Za-z0-9_-]*/, $.attribute_id),
            optional(
                seq($._inline_whitespace, 
                    choice(
                        $._commonmark_specifier_start_with_class, 
                        $._commonmark_specifier_start_with_kv))),
        ),

        _commonmark_specifier_start_with_class: $ => seq(
            alias(/[.][A-Za-z][A-Za-z0-9_-]*/, $.attribute_class),
            optional(repeat(seq($._inline_whitespace, alias(/[.][A-Za-z][A-Za-z0-9_-]*/, $.attribute_class)))),
            optional(seq($._inline_whitespace, $._commonmark_specifier_start_with_kv)),
        ),

        _commonmark_specifier_start_with_kv: $ => seq(
            alias($._commonmark_key_value_specifier, $.key_value_specifier),
            optional(repeat(seq($._inline_whitespace, alias($._commonmark_key_value_specifier, $.key_value_specifier)))),
            optional($._inline_whitespace)
        ),

        _commonmark_key_value_specifier: $ => seq(
            alias($._key_specifier_token, $.key_value_key),
            optional($._inline_whitespace),
            '=',
            optional($._inline_whitespace),
            alias(choice($._value_specifier_token, $._commonmark_single_quote_string, $._commonmark_double_quote_string), $.key_value_value)
        ),

        _commonmark_naked_value: $ => /[A-Za-z0-9_-]+/,
        _commonmark_single_quote_string: $ => /['][^']*[']/,
        _commonmark_double_quote_string: $ => /["][^"]*["]/,

        _line: $ => seq($._inline_element, repeat(seq(optional(alias($._whitespace, $.pandoc_space)), $._inline_element))),

        _inline_element: $ => choice(
            $.pandoc_str, 
            $.pandoc_span,
            $.pandoc_math,
            $.pandoc_display_math,
            $.pandoc_code_span,
            $.pandoc_image,

            alias($._html_comment, $.comment),

            $.prose_punctuation,
            $.attribute_specifier
        ),

        // Things that are parsed directly as a pandoc str
        pandoc_str: $ => /[0-9A-Za-z%&()+-/][0-9A-Za-z!%&()+,./;?:-]*/,
        prose_punctuation: $ => alias(/[.,;!?]+/, $.pandoc_str),

        // A blank line including the following newline.
        //
        // https://github.github.com/gfm/#blank-lines
        _blank_line: $ => seq($._blank_line_start, choice($._newline, $._eof)),

        // CONTAINER BLOCKS

        ///////////////////////////////////////////////////////////////////////////////////////////
        // A block quote. This is the most basic example of a container block handled by the
        // external scanner.
        //
        // https://github.github.com/gfm/#block-quotes
        pandoc_block_quote: $ => seq(
            alias($._block_quote_start, $.block_quote_marker),
            optional($.block_continuation),
            repeat($._block),
            $._block_close,
            optional($.block_continuation)
        ),

        ///////////////////////////////////////////////////////////////////////////////////////////
        // A list. This grammar does not differentiate between loose and tight lists for efficiency
        // reasons.
        //
        // Lists can only contain list items with list markers of the same type. List items are
        // handled by the external scanner.
        //
        // https://github.github.com/gfm/#lists
        pandoc_list: $ => prec.right(choice(
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
        ),

        ///////////////////////////////////////////////////////////////////////////////////////////
        // A fenced code block. Fenced code blocks are mainly handled by the external scanner. In
        // case of backtick code blocks the external scanner also checks that the info string is
        // proper.
        //
        // https://github.github.com/gfm/#fenced-code-blocks
        pandoc_code_block: $ => prec.right(choice(
            seq(
                alias($._fenced_code_block_start_backtick, $.fenced_code_block_delimiter),
                optional($._whitespace),
                optional(choice(alias($._commonmark_naked_value, $.info_string), $.attribute_specifier)),
                $._newline,
                optional($.code_fence_content),
                optional(seq(alias($._fenced_code_block_end_backtick, $.fenced_code_block_delimiter), $._close_block, choice($._newline, $._eof))),
                $._block_close,
            ),
        )),
        code_fence_content: $ => repeat1(choice($._newline, $._code_line)),
        _code_line:         $ => /[^\n]+/,
        

        ///////////////////////////////////////////////////////////////////////////////////////////
        // fenced divs

        pandoc_div: $ => seq(
          $._fenced_div_start,
          $._whitespace,
          choice(alias($._commonmark_naked_value, $.info_string), $.attribute_specifier),
          $._newline,
          repeat($._block),
          optional(seq($._fenced_div_end, $._close_block, choice($._newline, $._eof))),
          $._block_close,
        ),

        ///////////////////////////////////////////////////////////////////////////////////////////
        // qmd extension: a fenced block for note definitions:

        /// ::: ^note
        /// this is a longer note
        /// 
        /// many paras even
        /// :::

        note_definition_fenced_block: $ => seq(
            $._fenced_div_start,
            $._whitespace,
            $.fenced_div_note_id,
            $._newline,
            repeat($._block),
            optional(seq($._fenced_div_end, $._close_block, choice($._newline, $._eof))),
            $._block_close,
        ),

        ///////////////////////////////////////////////////////////////////////////////////////////
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

        _inline_whitespace: $ => choice($._whitespace, $._soft_line_break),
        _whitespace: $ => /[ \t]+/,

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
        $._autolink,

        $._language_specifier_token, // external so we can do negative lookahead assertions.
        $._key_specifier_token,
        $._value_specifier_token, // external so we can emit it only when allowed

        $._highlight_span_start,
    ],
    precedences: $ => [],
    extras: $ => [],
});