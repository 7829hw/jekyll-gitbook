{
    "page": {
        "title": "Introduction",
        "level": "1.1",
        "depth": 1,
        {% assign first_book_page = site.data.mcp_book.english | first %}
        {% if first_book_page %}
        "next": {
            "title": {{ first_book_page.title | jsonify }},
            "level": "1.2",
            "depth": 1,
            "path": {{ first_book_page.url | jsonify }},
            "ref": {{ first_book_page.url | jsonify }},
            "articles": []
        },
        {% endif %}
        "dir": "ltr"
    },

    {%- include metadata.json.tpl -%}
}
