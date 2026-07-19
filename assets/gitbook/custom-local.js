require(['gitbook', 'jquery'], function(gitbook, $) {
    var HEADER_SCROLL_NAMESPACE = '.autoHideHeader',
        HEADER_TOP_THRESHOLD = 12,
        HEADER_DIRECTION_THRESHOLD = 10,
        keyboardInputActive = false,
        requestFrame = window.requestAnimationFrame
            ? window.requestAnimationFrame.bind(window)
            : function(callback) { return window.setTimeout(callback, 16); };

    function showHeader($book) {
        $book.removeClass('is-header-hidden');
    }

    function hideHeader($book) {
        var $header = $book.find('.book-header');

        if (keyboardInputActive && $header.find(':focus').length) return;

        $header.find('.dropdown-menu.open').removeClass('open');
        $book.addClass('is-header-hidden');
    }

    function bindHeaderAutoHide() {
        var $book = gitbook.state.$book && gitbook.state.$book.length
            ? gitbook.state.$book
            : $('.book');
        var $scrollContainers = $book.find('.book-body, .body-inner');

        showHeader($book);

        $(document)
            .off('keydown' + HEADER_SCROLL_NAMESPACE)
            .on('keydown' + HEADER_SCROLL_NAMESPACE, function() {
                keyboardInputActive = true;
            })
            .off('pointerdown' + HEADER_SCROLL_NAMESPACE +
                ' mousedown' + HEADER_SCROLL_NAMESPACE +
                ' touchstart' + HEADER_SCROLL_NAMESPACE +
                ' wheel' + HEADER_SCROLL_NAMESPACE)
            .on('pointerdown' + HEADER_SCROLL_NAMESPACE +
                ' mousedown' + HEADER_SCROLL_NAMESPACE +
                ' touchstart' + HEADER_SCROLL_NAMESPACE +
                ' wheel' + HEADER_SCROLL_NAMESPACE, function() {
                keyboardInputActive = false;
            });

        $scrollContainers
            .off('scroll' + HEADER_SCROLL_NAMESPACE)
            .each(function() {
                var $container = $(this);
                var previousScrollTop = Math.max(0, $container.scrollTop());
                var directionDistance = 0;
                var framePending = false;

                $container.on('scroll' + HEADER_SCROLL_NAMESPACE, function() {
                    if (framePending) return;
                    framePending = true;

                    requestFrame(function() {
                        var currentScrollTop = Math.max(0, $container.scrollTop());
                        var delta = currentScrollTop - previousScrollTop;

                        if (currentScrollTop <= HEADER_TOP_THRESHOLD) {
                            showHeader($book);
                            directionDistance = 0;
                        } else if (delta !== 0) {
                            if ((delta > 0 && directionDistance < 0) ||
                                (delta < 0 && directionDistance > 0)) {
                                directionDistance = 0;
                            }

                            directionDistance += delta;

                            if (directionDistance >= HEADER_DIRECTION_THRESHOLD) {
                                hideHeader($book);
                                directionDistance = 0;
                            } else if (directionDistance <= -HEADER_DIRECTION_THRESHOLD) {
                                showHeader($book);
                                directionDistance = 0;
                            }
                        }

                        previousScrollTop = currentScrollTop;
                        framePending = false;
                    });
                });
            });

        $book.find('.book-header')
            .off('focusin' + HEADER_SCROLL_NAMESPACE)
            .on('focusin' + HEADER_SCROLL_NAMESPACE, function() {
                showHeader($book);
            });
    }

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

        bindHeaderAutoHide();
    }

    gitbook.events.bind('page.change', enhanceLayout);
});
