require(['gitbook', 'jquery'], function(gitbook, $) {
    var MOBILE_SIDEBAR_NAMESPACE = '.mobileSidebarDismiss';
    var MOBILE_SCROLL_NAMESPACE = '.mobileDocumentScroll';

    function isMobile() {
        return $(document).width() <= 600;
    }

    function scrollMobileDocumentToHash(hash, animate) {
        if (!isMobile() || !hash) return;

        var id;
        try {
            id = decodeURIComponent(hash.substring(1));
        } catch (error) {
            id = hash.substring(1);
        }

        var target = document.getElementById(id);
        if (!target) return;

        var top = Math.max(0, $(target).offset().top);
        if (animate) {
            $('html, body').stop().animate({scrollTop: top}, 300);
        } else {
            window.scrollTo(0, top);
        }
    }

    function bindMobileDocumentAnchors() {
        $(document)
            .off('click' + MOBILE_SCROLL_NAMESPACE, '.page-inner a[href*="#"], .book-summary a[href*="#"]')
            .on('click' + MOBILE_SCROLL_NAMESPACE, '.page-inner a[href*="#"], .book-summary a[href*="#"]', function() {
                if (!isMobile()) return;

                var link = document.createElement('a');
                link.href = this.href;
                if (link.pathname !== window.location.pathname || !link.hash) return;

                scrollMobileDocumentToHash(link.hash, true);
            });
    }

    function bindMobileSidebarDismiss() {
        var $book = gitbook.state.$book && gitbook.state.$book.length
            ? gitbook.state.$book
            : $('.book');

        $book.find('.book-body')
            .off('click' + MOBILE_SIDEBAR_NAMESPACE)
            .on('click' + MOBILE_SIDEBAR_NAMESPACE, function(event) {
                if ($(event.target).closest('.js-toggle-summary').length ||
                    $(event.target).closest('.sidebar-toggle-fab').length ||
                    $(document).width() > 600 ||
                    !gitbook.sidebar ||
                    !gitbook.sidebar.isOpen()) return;

                event.preventDefault();
                event.stopPropagation();
                gitbook.sidebar.toggle(false);
            });
    }

    // Create modern floating sidebar toggle button
    function createFloatingToggleButton() {
        // Remove existing FAB if any
        $('.sidebar-toggle-fab').remove();

        var $fab = $('<a>', {
            'class': 'sidebar-toggle-fab',
            'href': '#',
            'aria-label': 'Toggle sidebar navigation',
            'title': 'Toggle sidebar (S)',
            'role': 'button'
        }).html('<i class="fa fa-bars"></i>');

        $fab.on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Try multiple methods to toggle sidebar
            if (gitbook.sidebar && gitbook.sidebar.toggle) {
                gitbook.sidebar.toggle();
            } else if ($('.book').hasClass('with-summary')) {
                $('.book').removeClass('with-summary');
                $fab.html('<i class="fa fa-bars"></i>');
            } else {
                $('.book').addClass('with-summary');
                $fab.html('<i class="fa fa-times"></i>');
            }
            // Update icon after short delay
            setTimeout(function() {
                updateIcon();
            }, 50);
        });

        $('body').append($fab);

        // Update icon based on sidebar state
        function updateIcon() {
            var isOpen = false;
            if (gitbook.sidebar && gitbook.sidebar.isOpen) {
                isOpen = gitbook.sidebar.isOpen();
            } else {
                isOpen = $('.book').hasClass('with-summary');
            }
            $fab.html(isOpen ? '<i class="fa fa-times"></i>' : '<i class="fa fa-bars"></i>');
        }

        // Listen for sidebar changes - use bind instead of on for compatibility
        if (gitbook.events && gitbook.events.bind) {
            gitbook.events.bind('sidebar.toggle', updateIcon);
        }

        // Initial icon state and periodic updates
        setTimeout(updateIcon, 100);
        setTimeout(updateIcon, 500);
        setTimeout(updateIcon, 1000);
        // Also update on window resize
        $(window).on('resize', updateIcon);
    }

    function enhanceLayout() {
        var $bodyInner = $('.body-inner');

        $('.markdown-section table').each(function() {
            if (!$(this).parent().hasClass('table-wrapper')) {
                $(this).wrap('<div class="table-wrapper"></div>');
            }
        });

        $('.book-header .fa-align-justify').parent()
            .addClass('js-toggle-summary')
            .attr('aria-label', 'Toggle navigation');
        $('.book-header .fa-facebook').parent().attr('aria-label', 'Share on Facebook');
        $('.book-header .fa-twitter').parent().attr('aria-label', 'Share on X');
        $('.book-header .fa-github').parent().attr('aria-label', 'Open GitHub');

        // Create the modern floating toggle button
        createFloatingToggleButton();

        bindMobileSidebarDismiss();
        bindMobileDocumentAnchors();

        if (isMobile()) {
            window.requestAnimationFrame(function() {
                if (window.location.hash) {
                    scrollMobileDocumentToHash(window.location.hash, false);
                } else {
                    window.scrollTo(0, 0);
                }
            });
        } else if (!window.location.hash) {
            $bodyInner.scrollTop(0);
        }
    }

    gitbook.events.bind('page.change', enhanceLayout);
});
