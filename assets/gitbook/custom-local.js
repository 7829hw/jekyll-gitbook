require(['gitbook', 'jquery'], function(gitbook, $) {
    var MOBILE_SIDEBAR_NAMESPACE = '.mobileSidebarDismiss';
    var DOCUMENT_SCROLL_NAMESPACE = '.nativeDocumentScroll';
    var SIDEBAR_FAB_NAMESPACE = '.sidebarFab';
    var lastScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    var scrollTicking = false;

    function isMobile() {
        return $(document).width() <= 600;
    }

    function scrollDocumentToHash(hash, animate) {
        if (!hash) return;

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

    function bindDocumentAnchors() {
        $(document)
            .off('click' + DOCUMENT_SCROLL_NAMESPACE, '.page-inner a[href*="#"], .book-summary a[href*="#"]')
            .on('click' + DOCUMENT_SCROLL_NAMESPACE, '.page-inner a[href*="#"], .book-summary a[href*="#"]', function() {
                var link = document.createElement('a');
                link.href = this.href;
                if (link.pathname !== window.location.pathname || !link.hash) return;

                scrollDocumentToHash(link.hash, true);
            });
    }

    function getBook() {
        return gitbook.state.$book && gitbook.state.$book.length
            ? gitbook.state.$book
            : $('.book');
    }

    function updateSidebarFabState() {
        var $button = $('.sidebar-fab');
        var isOpen = Boolean(gitbook.sidebar && gitbook.sidebar.isOpen());

        $button
            .toggleClass('is-open', isOpen)
            .attr('aria-expanded', isOpen)
            .attr('aria-label', isOpen ? '목차 닫기' : '목차 열기');
        $button.find('i')
            .toggleClass('fa-bars', !isOpen)
            .toggleClass('fa-times', isOpen);

        if (isOpen) {
            $button.addClass('is-visible');
        }
    }

    function bindSidebarFab() {
        var $book = getBook();
        var $summary = $book.find('.book-summary');
        var $button = $book.find('.sidebar-fab');

        $summary.attr('id', 'book-summary');

        if (!$button.length) {
            $button = $(
                '<button type="button" class="sidebar-fab" aria-controls="book-summary" aria-expanded="false">' +
                    '<i class="fa fa-bars" aria-hidden="true"></i>' +
                '</button>'
            ).appendTo($book);
        }

        $button
            .off('click' + SIDEBAR_FAB_NAMESPACE)
            .on('click' + SIDEBAR_FAB_NAMESPACE, function() {
                if (!gitbook.sidebar) return;
                gitbook.sidebar.toggle(!gitbook.sidebar.isOpen());
                updateSidebarFabState();
            });

        $(document)
            .off('click' + SIDEBAR_FAB_NAMESPACE, '.js-toggle-summary')
            .on('click' + SIDEBAR_FAB_NAMESPACE, '.js-toggle-summary', function() {
                window.requestAnimationFrame(updateSidebarFabState);
            });

        $(window)
            .off('scroll' + SIDEBAR_FAB_NAMESPACE)
            .on('scroll' + SIDEBAR_FAB_NAMESPACE, function() {
                if (scrollTicking) return;
                scrollTicking = true;

                window.requestAnimationFrame(function() {
                    var currentScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
                    var $currentButton = $('.sidebar-fab');

                    if (gitbook.sidebar && gitbook.sidebar.isOpen()) {
                        $currentButton.addClass('is-visible');
                    } else if (currentScrollTop <= 8 || currentScrollTop > lastScrollTop) {
                        $currentButton.removeClass('is-visible');
                    } else if (lastScrollTop - currentScrollTop > 2) {
                        $currentButton.addClass('is-visible');
                    }

                    lastScrollTop = currentScrollTop;
                    scrollTicking = false;
                });
            });

        updateSidebarFabState();
    }

    function bindMobileSidebarDismiss() {
        var $book = getBook();

        $book.find('.book-body')
            .off('click' + MOBILE_SIDEBAR_NAMESPACE)
            .on('click' + MOBILE_SIDEBAR_NAMESPACE, function(event) {
                if ($(event.target).closest('.js-toggle-summary').length ||
                    !isMobile() ||
                    !gitbook.sidebar ||
                    !gitbook.sidebar.isOpen()) return;

                event.preventDefault();
                event.stopPropagation();
                gitbook.sidebar.toggle(false);
                updateSidebarFabState();
            });
    }

    function enhanceLayout() {
        $('.markdown-section table').each(function() {
            if (!$(this).parent().hasClass('table-wrapper')) {
                $(this).wrap('<div class="table-wrapper"></div>');
            }
        });

        $('.book-header .fa-align-justify').parent()
            .addClass('js-toggle-summary')
            .attr('aria-label', 'Toggle navigation');

        if (gitbook.sidebar) {
            gitbook.sidebar.toggle(false, false);
        }
        bindSidebarFab();
        bindMobileSidebarDismiss();
        bindDocumentAnchors();
        lastScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;

        window.requestAnimationFrame(function() {
            if (window.location.hash) {
                scrollDocumentToHash(window.location.hash, false);
            } else {
                window.scrollTo(0, 0);
            }
        });
    }

    gitbook.events.bind('page.change', enhanceLayout);
});
