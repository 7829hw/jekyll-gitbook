require(['gitbook', 'jquery'], function(gitbook, $) {
    function enhanceLayout() {
        $('.markdown-section table').each(function() {
            if (!$(this).parent().hasClass('table-wrapper')) {
                $(this).wrap('<div class="table-wrapper"></div>');
            }
        });

        $('.book-header .fa-align-justify').parent().attr('aria-label', 'Toggle navigation');
        $('.book-header .fa-facebook').parent().attr('aria-label', 'Share on Facebook');
        $('.book-header .fa-twitter').parent().attr('aria-label', 'Share on X');
        $('.book-header .fa-github').parent().attr('aria-label', 'Open GitHub');
    }

    gitbook.events.bind('page.change', enhanceLayout);
});
