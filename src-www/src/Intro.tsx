import React, { Component, type JSX } from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import {
    AppBar,
    Button,
    Paper,
    Toolbar,
    Grid2,
    CardContent,
    CardMedia,
    Box,
    Link,
    Card,
    CardActions,
    Divider,
    IconButton,
} from '@mui/material';
import { Logout, Launch } from '@mui/icons-material';

import {
    type IobTheme,
    I18n,
    Theme,
    type ThemeName,
    Utils,
    type ThemeType,
    ToggleThemeMenu,
} from '@iobroker/adapter-react-v5';

import enLang from './i18n/en.json';
import deLang from './i18n/de.json';
import ruLang from './i18n/ru.json';
import ptLang from './i18n/pt.json';
import nlLang from './i18n/nl.json';
import frLang from './i18n/fr.json';
import itLang from './i18n/it.json';
import esLang from './i18n/es.json';
import plLang from './i18n/pl.json';
import ukLang from './i18n/uk.json';
import zhCnLang from './i18n/zh-cn.json';

export interface LocalLinkEntry {
    id?: `system.adapter.${string}.${number}`;
    link: string;
    instance?: number;
    localLink: string;
    name?: ioBroker.StringOrTranslated;
    pro: boolean;
    color?: string;
    img?: string;
    order?: number;
}

export interface LocalMultipleLinkEntry extends Omit<LocalLinkEntry, 'localLink'> {
    localLink: string | { [instance: string]: string };
}
const boxShadowHover = '0 8px 17px 0 rgba(0, 0, 0, .2),0 6px 20px 0 rgba(0, 0, 0, .19)';

export const styles: Record<string, any> = {
    root: (theme: IobTheme) => ({
        padding: '.75rem',
        [theme.breakpoints.up('xl')]: {
            flex: '0 1 20%',
        },
    }),
    card: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        minHeight: '235px',
        position: 'relative',
        overflow: 'hidden',
        maxHeight: '235p',
        '&:hover': {
            overflowY: 'auto',
            boxShadow: boxShadowHover,
        },
    },
    media: (theme: IobTheme) => ({
        backgroundColor: theme.palette.mode === 'dark' ? '#535353' : '#e2e2e2',
        maxWidth: '30%',
    }),
    img: {
        width: 120,
        height: 'auto',
        padding: '2rem .5rem',
        maxWidth: '100%',
    },
    contentContainer: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
    },
    content: {
        height: '170px',
        flexGrow: 1,
        overflowY: 'hidden',
    },
    action: {
        minHeight: '49px',
        padding: '16px 24px',
        justifyContent: 'center',
        fontSize: '1.4rem',
    },
    collapse: {
        minHeight: '100%',
        backgroundColor: '#ffffff',
        position: 'absolute',
        width: '100%',
    },
    contentGrid: {
        height: '100%',
        alignItems: 'center',
    },
    colorOrange: (theme: IobTheme) => ({
        color: theme.palette.mode === 'dark' ? '#3399CC' : '#164477',
    }),
    tooltip: {
        pointerEvents: 'none',
    },
};

type CardConfig = {
    link: string;
    img?: string;
    color?: string;
    name: string;
    instance?: number;
    order?: number;
};

type Config = {
    systemLang: ioBroker.Languages;
    showAdminInstances: boolean;
    authEnabled: boolean;
    list: LocalMultipleLinkEntry[];
};

interface LoginState {
    config: Config | null;
    cards: CardConfig[];
    theme: IobTheme;
    themeName: ThemeName;
    themeType: ThemeType;
}

class Intro extends Component<object, LoginState> {
    constructor(props: object) {
        super(props);

        const theme = Intro.createTheme();

        this.state = {
            theme,
            themeName: Intro.getThemeName(theme),
            themeType: Intro.getThemeType(theme),
            config: null,
            cards: [],
        };
        if (theme.palette.mode === 'dark') {
            document.body.style.backgroundColor = '#030303';
        }

        I18n.setTranslations({
            en: enLang,
            de: deLang,
            ru: ruLang,
            pt: ptLang,
            nl: nlLang,
            fr: frLang,
            it: itLang,
            es: esLang,
            pl: plLang,
            uk: ukLang,
            'zh-cn': zhCnLang,
        });
    }

    componentDidMount(): void {
        void fetch('config.json')
            .then(res => res.json())
            .then((config: Config) => {
                I18n.setLanguage(config.systemLang);
                const cards: {
                    link: string;
                    img?: string;
                    color?: string;
                    name: string;
                    instance?: number;
                    order?: number;
                }[] = [];
                for (let i = 0; i < config.list.length; i++) {
                    if (
                        typeof config.list[i] === 'object' &&
                        typeof config.list[i].localLink === 'string' &&
                        (config.showAdminInstances || !(config.list[i].localLink as string).includes(':'))
                    ) {
                        if (config.list[i].localLink && typeof config.list[i].localLink === 'string') {
                            config.list[i].link = (config.list[i].localLink as string).replace(
                                '$host$',
                                location.hostname,
                            );
                        }
                        if (config.list[i].link.startsWith(':')) {
                            config.list[i].link = `${location.protocol}//${location.hostname}${config.list[i].link}`;
                        }

                        let name = config.list[i].name || config.list[i].localLink;
                        if (typeof name === 'object') {
                            name = name[config.systemLang] || name.en;
                        }

                        if (!cards.find(card => card.link === config.list[i].link)) {
                            cards.push({
                                link: config.list[i].link,
                                img: config.list[i].img,
                                name:
                                    name + (config.list[i].instance !== undefined ? `.${config.list[i].instance}` : ''),
                                order: config.list[i].order,
                            });
                        }
                    }
                }
                this.setState({ config, cards });
            });
    }

    /**
     * Get a theme
     */
    private static createTheme(name?: ThemeName): IobTheme {
        return Theme(Utils.getThemeName(name));
    }

    /**
     * Get the theme name
     */
    private static getThemeName(theme: IobTheme): ThemeName {
        return theme.name;
    }

    /**
     * Get the theme type
     */
    private static getThemeType(theme: IobTheme): ThemeType {
        return theme.palette.mode;
    }

    /** Changes the current theme */
    toggleTheme = (currentThemeName?: ThemeName): void => {
        const themeName = this.state.themeName;

        const newThemeName = currentThemeName || Utils.toggleTheme(themeName);

        const theme = Intro.createTheme(newThemeName);

        if (theme.palette.mode === 'dark') {
            document.body.style.backgroundColor = '#030303';
        } else {
            document.body.style.backgroundColor = '#f0f0f0';
        }
        this.setState({
            theme,
            themeName: newThemeName,
            themeType: Intro.getThemeType(theme),
        });
    };

    static onLogout(): void {
        window.localStorage.removeItem('refresh_token');
        window.localStorage.removeItem('refresh_token_exp');
        window.localStorage.removeItem('access_token_exp');
        window.sessionStorage.removeItem('refresh_token');
        window.sessionStorage.removeItem('refresh_token_exp');
        window.sessionStorage.removeItem('access_token_exp');
        window.location.href = '/logout';
    }

    renderCard(item: CardConfig, i: number): JSX.Element {
        return (
            <Grid2
                key={i}
                size={{
                    xs: 12,
                    sm: 6,
                    md: 4,
                    lg: 3,
                    xl: 2,
                }}
                sx={Utils.getStyle(this.state.theme, styles.root)}
                style={{ maxWidth: 350, width: '100%' }}
            >
                <Link
                    href={item.link}
                    underline="none"
                    target="_self"
                    rel="noopener noreferrer"
                >
                    <Card sx={styles.card}>
                        <CardContent style={styles.content}>
                            <Grid2
                                container
                                direction="column"
                                wrap="nowrap"
                                style={styles.contentGrid}
                            >
                                <CardMedia
                                    style={styles.img}
                                    component="img"
                                    image={item.img}
                                />
                            </Grid2>
                        </CardContent>
                        <Divider />
                        <CardActions style={styles.action}>
                            <Box
                                sx={styles.colorOrange}
                                style={{ flexGrow: 1, textAlign: 'center' }}
                            >
                                {item.name}
                            </Box>
                            <IconButton
                                onClick={e => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    // Open in new tab
                                    window.open(item.link, item.name);
                                }}
                            >
                                <Launch />
                            </IconButton>
                        </CardActions>
                    </Card>
                </Link>
            </Grid2>
        );
    }

    render(): JSX.Element {
        const smallScreen = window.innerWidth < 600;

        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <AppBar
                        style={{ backgroundColor: this.state.theme.palette.mode === 'dark' ? undefined : '#f0f0f0' }}
                    >
                        <Toolbar style={{ gap: 8 }}>
                            <img
                                src="logo.svg"
                                alt="Logo"
                                style={{ height: smallScreen ? 32 : 48 }}
                            />
                            <div style={{ flexGrow: 1, textAlign: 'center' }}>{smallScreen ? '' : 'ioBroker.web'}</div>
                            {this.state.config?.authEnabled ? (
                                smallScreen ? (
                                    <IconButton onClick={() => Intro.onLogout()}>
                                        <Logout />
                                    </IconButton>
                                ) : (
                                    <Button
                                        variant="outlined"
                                        startIcon={<Logout />}
                                        onClick={() => Intro.onLogout()}
                                    >
                                        {I18n.t('Sign out')}
                                    </Button>
                                )
                            ) : null}
                            {this.state.themeName !== 'PT' && this.state.themeName !== 'DX' ? (
                                <ToggleThemeMenu
                                    t={I18n.t}
                                    themeName={this.state.themeName}
                                    toggleTheme={() => this.toggleTheme()}
                                />
                            ) : null}
                        </Toolbar>
                    </AppBar>

                    <Paper
                        className={this.state.themeType === 'dark' ? 'theme-dark' : 'theme-light'}
                        style={{
                            backgroundColor: this.state.themeType === 'dark' ? '#080808' : '#f0f0f0',
                            display: 'flex',
                            flexFlow: 'wrap',
                            overflow: 'auto',
                            justifyContent: 'center',
                            width: 'calc(100% - 1rem)',
                            height: 'calc(100% - 1rem - 64px)',
                            marginTop: 64,
                            overflowY: 'auto',
                            padding: '0.5rem',
                        }}
                        component="div"
                    >
                        {this.state.cards.map((item, i) => this.renderCard(item, i))}
                    </Paper>
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}

export default Intro;
