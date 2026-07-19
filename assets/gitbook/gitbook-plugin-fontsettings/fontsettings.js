require(['gitbook', 'jquery'], function(gitbook, $) {
    // Configuration
    var FONT_SIZE_VERSION = 2,
        DEFAULT_SIZE    = 2,
        FONT_SIZES     = [1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0],
        LEGACY_SIZE_MAP = [0, 1, 2, 5, 14],
        MAX_SIZE       = FONT_SIZES.length - 1,
        MIN_SIZE       = 0,
        SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)',
        BUTTON_ID;

    // Current fontsettings state
    var fontState,
        systemThemeMedia = window.matchMedia ? window.matchMedia(SYSTEM_THEME_QUERY) : null,
        systemThemeListenerAttached = false;

    // Default themes
    var THEMES = [
        {
            config: 'white',
            text: 'White',
            id: 0
        },
        {
            config: 'sepia',
            text: 'Sepia',
            id: 1
        },
        {
            config: 'night',
            text: 'Night',
            id: 2
        }
    ];

    // Default font families
    var FAMILIES = [
        {
            config: 'serif',
            text: 'Serif',
            id: 0
        },
        {
            config: 'sans',
            text: 'Sans',
            id: 1
        }
    ];

    // Return configured themes
    function getThemes() {
        return THEMES;
    }

    // Modify configured themes
    function setThemes(themes) {
        THEMES = themes;
        updateButtons();
        if (fontState) update();
    }

    // Return configured font families
    function getFamilies() {
        return FAMILIES;
    }

    // Modify configured font families
    function setFamilies(families) {
        FAMILIES = families;
        updateButtons();
    }

    // Save current font settings
    function saveFontSettings() {
        gitbook.storage.set('fontState', fontState);
        update();
    }

    // Increase font size
    function enlargeFontSize(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (fontState.size >= MAX_SIZE) return;

        fontState.size++;
        saveFontSettings();
    }

    // Decrease font size
    function reduceFontSize(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (fontState.size <= MIN_SIZE) return;

        fontState.size--;
        saveFontSettings();
    }

    // Restore the configured default font size
    function resetFontSize(e) {
        if (e) e.preventDefault();

        fontState.size = DEFAULT_SIZE;
        saveFontSettings();
    }

    // Change font family
    function changeFontFamily(configName, e) {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }

        var familyId = getFontFamilyId(configName);
        fontState.family = familyId;
        saveFontSettings();
    }

    // Change type of color theme
    function changeColorTheme(configName, e) {
        if (configName === 'auto') {
            return useSystemTheme(e);
        }

        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }

        fontState.theme = getThemeId(configName);
        fontState.themeMode = 'manual';
        saveFontSettings();
    }

    // Follow the operating system color scheme until a theme is selected manually.
    function useSystemTheme(e) {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }

        fontState.themeMode = 'auto';
        saveFontSettings();
    }

    // Return the correct id for a font-family config key
    // Default to first font-family
    function getFontFamilyId(configName) {
        // Search for plugin configured font family
        var configFamily = $.grep(FAMILIES, function(family) {
            return family.config == configName;
        })[0];
        // Fallback to default font family
        return (!!configFamily)? configFamily.id : 0;
    }

    // Return the correct id for a theme config key
    // Default to first theme
    function getThemeId(configName) {
        // Search for plugin configured theme
        var configTheme = $.grep(THEMES, function(theme) {
            return theme.config == configName;
        })[0];
        // Fallback to default theme
        return (!!configTheme)? configTheme.id : 0;
    }

    function getThemeConfig(themeId) {
        var theme = $.grep(THEMES, function(candidate) {
            return candidate.id == themeId;
        })[0];

        return (!!theme)? theme.config : 'white';
    }

    function getEffectiveThemeId() {
        if (fontState.themeMode !== 'auto') {
            return fontState.theme;
        }

        return systemThemeMedia && systemThemeMedia.matches
            ? getThemeId('night')
            : getThemeId('white');
    }

    function syncThemeButtons(effectiveThemeId) {
        var $themeButtons = $('.font-settings .font-theme-option');
        var activeSelector = fontState.themeMode === 'auto'
            ? '.font-theme-auto'
            : '.font-theme-' + getThemeConfig(effectiveThemeId);

        $themeButtons.removeClass('active').attr('aria-pressed', 'false');
        $('.font-settings ' + activeSelector).addClass('active').attr('aria-pressed', 'true');
    }

    function trackSystemTheme() {
        if (!systemThemeMedia || systemThemeListenerAttached) return;

        var handleSystemThemeChange = function() {
            if (fontState && fontState.themeMode === 'auto') update();
        };

        if (typeof systemThemeMedia.addEventListener === 'function') {
            systemThemeMedia.addEventListener('change', handleSystemThemeChange);
        } else if (typeof systemThemeMedia.addListener === 'function') {
            systemThemeMedia.addListener(handleSystemThemeChange);
        }

        systemThemeListenerAttached = true;
    }

    function update() {
        var $book = gitbook.state.$book;
        var $header = $('.book-body > .book-header');
        var effectiveThemeId = getEffectiveThemeId();
        var effectiveThemeConfig = getThemeConfig(effectiveThemeId);

        if (!$book || !$book.length) return;

        $('.font-settings .font-family-list li').removeClass('active');
        $('.font-settings .font-family-list li:nth-child('+(fontState.family+1)+')').addClass('active');

        $book[0].className = $book[0].className.replace(/\bfont-\S+/g, '');
        $book[0].className = $book[0].className.replace(/\bcolor-theme-\S+/g, '');
        $book[0].className = $book[0].className.replace(/\btheme-mode-\S+/g, '');
        $book.addClass('font-size-'+fontState.size);
        $book.addClass('font-family-'+fontState.family);
        $book.addClass('theme-mode-'+fontState.themeMode);
        document.documentElement.style.setProperty('--book-font-size', FONT_SIZES[fontState.size]+'rem');

        if (effectiveThemeId !== 0) {
            $book.addClass('color-theme-'+effectiveThemeId);
        }

        if ($header.length) {
            $header[0].className = $header[0].className.replace(/\bcolor-theme-\S+/g, '');
            if (effectiveThemeId !== 0) {
                $header.addClass('color-theme-'+effectiveThemeId);
            }
        }

        document.documentElement.setAttribute('data-book-color-theme', effectiveThemeConfig);
        document.documentElement.setAttribute('data-book-theme-mode', fontState.themeMode);
        $('meta[name="theme-color"]').attr('content', {
            white: '#ffffff',
            sepia: '#eee6d9',
            night: '#141512'
        }[effectiveThemeConfig] || '#ffffff');
        syncThemeButtons(effectiveThemeId);
    }

    function init(config) {
        config = config || {};

        // Search for plugin configured font family
        var configuredTheme = config.theme || 'auto',
            configFamily = getFontFamilyId(config.family),
            configTheme = getThemeId(configuredTheme === 'auto' ? 'white' : configuredTheme),
            configSize = typeof config.size === 'number' ? config.size : DEFAULT_SIZE;

        // Instantiate font state object. Existing non-white themes remain manual;
        // the former default white state migrates to system-following Auto mode.
        var storedState = gitbook.storage.get('fontState', null);
        fontState = storedState || {
            size:      configSize,
            family:    configFamily,
            theme:     configTheme,
            themeMode: configuredTheme === 'auto' ? 'auto' : 'manual'
        };

        if (fontState.themeMode !== 'auto' && fontState.themeMode !== 'manual') {
            fontState.themeMode = fontState.theme === 0 ? 'auto' : 'manual';
        }

        // Preserve the actual size selected with the legacy five-step scale.
        if (fontState.sizeVersion !== FONT_SIZE_VERSION) {
            fontState.size = LEGACY_SIZE_MAP[fontState.size];
            fontState.sizeVersion = FONT_SIZE_VERSION;
        }

        if (typeof fontState.size !== 'number' || fontState.size < MIN_SIZE || fontState.size > MAX_SIZE) {
            fontState.size = DEFAULT_SIZE;
        }

        if (typeof fontState.family !== 'number') {
            fontState.family = configFamily;
        }

        if (typeof fontState.theme !== 'number') {
            fontState.theme = configTheme;
        }

        gitbook.storage.set('fontState', fontState);

        trackSystemTheme();
        update();
    }

    function updateButtons() {
        // Remove existing fontsettings buttons
        if (!!BUTTON_ID) {
            gitbook.toolbar.removeButton(BUTTON_ID);
        }

        // Create buttons in toolbar
        BUTTON_ID = gitbook.toolbar.createButton({
            icon: 'fa fa-font',
            label: 'Font Settings',
            className: 'font-settings',
            dropdown: [
                [
                    {
                        text: 'A−',
                        className: 'font-reduce',
                        onClick: reduceFontSize
                    },
                    {
                        text: 'Reset',
                        className: 'font-reset',
                        onClick: resetFontSize
                    },
                    {
                        text: 'A+',
                        className: 'font-enlarge',
                        onClick: enlargeFontSize
                    }
                ],
                $.map(FAMILIES, function(family) {
                    family.onClick = function(e) {
                        return changeFontFamily(family.config, e);
                    };

                    return family;
                }),
                [{
                    text: 'Auto',
                    className: 'font-theme-option font-theme-auto',
                    onClick: useSystemTheme
                }].concat($.map(THEMES, function(theme) {
                    theme.className = 'font-theme-option font-theme-' + theme.config;
                    theme.onClick = function(e) {
                        return changeColorTheme(theme.config, e);
                    };

                    return theme;
                }))
            ]
        });
    }

    // Init configuration at start
    gitbook.events.bind('start', function(e, config) {
        var opts = config && config.fontsettings ? config.fontsettings : {};

        // Generate buttons at start
        updateButtons();

        // Init current settings
        init(opts);
    });

    // Re-apply state after GitBook replaces a page through AJAX navigation.
    gitbook.events.bind('page.change', function() {
        if (fontState) update();
    });

    // Expose API
    gitbook.fontsettings = {
        enlargeFontSize: enlargeFontSize,
        reduceFontSize:  reduceFontSize,
        resetFontSize:   resetFontSize,
        setTheme:        changeColorTheme,
        useSystemTheme:  useSystemTheme,
        setFamily:       changeFontFamily,
        getThemes:       getThemes,
        setThemes:       setThemes,
        getFamilies:     getFamilies,
        setFamilies:     setFamilies
    };
});


