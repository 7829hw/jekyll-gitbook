{
    "page": {
        "title": "Introduction",
        "level": "1.1",
        "depth": 1,
        {% if book_next %}
        "next": {
            "title": {{ book_next.title | jsonify }},
            "level": "1.2",
            "depth": 1,
            "path": {{ book_next.url | jsonify }},
            "ref": {{ book_next.url | jsonify }},
            "articles": []
        },
        {% endif %}
        "dir": "ltr"
    },

    {%- include metadata.json.tpl -%}
}
