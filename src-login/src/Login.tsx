import React, { Component, type JSX } from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControlLabel,
    Grid2,
    IconButton,
    Link,
    Paper,
    TextField,
    Typography,
} from '@mui/material';

import { Visibility } from '@mui/icons-material';

import {
    type IobTheme,
    I18n,
    Theme,
    type ThemeName,
    Utils,
    type ThemeType,
    ToggleThemeMenu,
    Connection,
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

export interface OAuth2Response {
    access_token: string;
    expires_in: number;
    token_type: 'Bearer' | 'JWT';
    refresh_token: string;
    refresh_token_expires_in: number;
}

const boxShadow = '0 4px 7px 5px rgb(0 0 0 / 14%), 0 3px 1px 1px rgb(0 0 0 / 12%), 0 1px 5px 0 rgb(0 0 0 / 20%)';

const styles: Record<string, any> = {
    root: {
        padding: 10,
        margin: 'auto',
        display: 'flex',
        height: '100%',
        alignItems: 'center',
        borderRadius: 0,
        justifyContent: 'center',
    },
    paper: (theme: IobTheme) => ({
        backgroundColor: theme.palette.background.paper + (theme.palette.background.paper.length < 7 ? 'd' : 'dd'),
        p: '24px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: 500,
        maxWidth: 380,
        boxShadow,
    }),
    form: {
        width: '100%', // Fix IE 11 issue.
        marginTop: 8,
    },
    submit: {
        margin: 8,
    },
    alert: {
        marginTop: 16,
        backgroundColor: '#f44336',
        padding: 8,
        color: '#fff',
        borderRadius: 4,
        fontSize: 16,
    },
    ioBrokerLink: {
        textTransform: 'inherit',
    },
    marginTop: {
        marginTop: 'auto',
    },
    progress: {
        textAlign: 'center',
    },
};

function Logo(props: { color: string }): React.JSX.Element {
    return (
        <div style={{ width: 100, textAlign: 'center' }}>
            <svg
                viewBox="0 0 512 512"
                width="100px"
                height="100px"
            >
                <path
                    fill={props.color}
                    d="M0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zM288 96a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM256 416c35.3 0 64-28.7 64-64c0-17.4-6.9-33.1-18.1-44.6L366 161.7c5.3-12.1-.2-26.3-12.3-31.6s-26.3 .2-31.6 12.3L257.9 288c-.6 0-1.3 0-1.9 0c-35.3 0-64 28.7-64 64s28.7 64 64 64zM176 144a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM96 288a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm352-32a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"
                />
            </svg>
        </div>
    );
}

declare global {
    interface Window {
        loginBackgroundColor: string;
        loginBackgroundImage: string;
        loginLink: string;
        loginMotto: string;
        login: string;
        loginLogo: string;
        loginHideLogo: string;
        loginTitle: string;
        loginOauth2: string;
        loginLanguage: ioBroker.Languages;
    }
}

interface LoginState {
    inProcess: boolean;
    username: string;
    password: string;
    stayLoggedIn: boolean;
    showPassword: boolean;
    error: string;
    loggingIn: boolean;
    theme: IobTheme;
    themeName: ThemeName;
    themeType: ThemeType;
}

class Login extends Component<object, LoginState> {
    private readonly formRef: React.RefObject<HTMLFormElement>;
    private readonly passwordRef: React.RefObject<HTMLInputElement>;

    constructor(props: object) {
        super(props);

        const loggingIn = window.loginOauth2 !== 'false' ? this.authenticateWithRefreshToken() : false;

        const theme = Login.createTheme();

        this.state = {
            inProcess: false,
            stayLoggedIn: false,
            showPassword: false,
            username: '',
            password: '',
            error: '',
            loggingIn,
            theme,
            themeName: Login.getThemeName(theme),
            themeType: Login.getThemeType(theme),
        };

        this.formRef = React.createRef();

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
        I18n.setLanguage(window.loginLanguage || 'en');

        // apply image
        const body = window.document.body;
        body.style.backgroundColor = window.loginBackgroundColor;
        body.style.backgroundImage = window.loginBackgroundImage;
        body.style.backgroundSize = 'cover';
        this.passwordRef = React.createRef();
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

        const theme = Login.createTheme(newThemeName);

        this.setState({
            theme,
            themeName: newThemeName,
            themeType: Login.getThemeType(theme),
        });
    };

    static async getAdapterName(): Promise<string> {
        const response = await fetch('../name');
        if (response.ok) {
            return await response.text();
        }

        return 'web.0';
    }

    static async processTokenAnswer(stayLoggedIn: boolean, response: Response): Promise<boolean> {
        if (response.ok) {
            const data: OAuth2Response = await response.json();

            if (data?.access_token) {
                const adapterName = await Login.getAdapterName();

                // The next loaded page with socket will take the ownership of the tokens
                Connection.saveTokensStatic(data, stayLoggedIn);
                // Get href from origin
                // Extract from the URL like "http://localhost:8084/login?href=http://localhost:63342/ioBroker.socketio/example/index.html?_ijt=nqn3c1on9q44elikut4rgr23j8&_ij_reload=RELOAD_ON_SAVE" the href
                const urlObj = new URL(window.location.href);
                const href = urlObj.searchParams.get('href');
                let origin;
                if (href) {
                    origin = href;
                    if (origin.startsWith('#')) {
                        origin = `./${origin}`;
                    }
                } else {
                    origin = './';
                }
                if (adapterName.startsWith('web.')) {
                    window.location.href = origin;
                } else {
                    window.location.href = `${origin}${origin.includes('?') ? '&' : '?'}token=${data.access_token}`;
                }
                return true;
            }
        }
        Connection.deleteTokensStatic();

        return false;
    }

    private authenticateWithRefreshToken(): boolean {
        const tokens = Connection.readTokens();

        if (tokens?.refresh_token) {
            void fetch('../oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `grant_type=refresh_token&refresh_token=${tokens.refresh_token}&stayloggedin=${tokens.stayLoggedIn}&client_id=ioBroker`,
            })
                .then(async response => {
                    await Login.processTokenAnswer(tokens.stayLoggedIn, response);

                    this.setState({
                        inProcess: false,
                        loggingIn: false,
                    });
                })
                .catch(error => {
                    console.error(`Cannot fetch access token: ${error}`);
                    this.setState({
                        inProcess: false,
                        loggingIn: false,
                    });
                });
            return true;
        }

        return false;
    }

    render(): JSX.Element {
        const action = `${window.location.port === '3000' ? `${window.location.protocol}//${window.location.hostname}:8082/` : '/login'}?${window.location.port === '3000' ? 'dev&' : ''}href=${window.location.hash}`;

        const link =
            window.loginLink && window.loginLink !== '@@loginLink@@' ? window.loginLink : 'https://www.iobroker.net/';
        const motto =
            window.loginMotto && window.loginMotto !== '@@loginMotto@@' ? window.loginMotto : 'Discover awesome. ';

        const style =
            (window.loginBackgroundColor &&
                window.loginBackgroundColor !== 'inherit' &&
                window.loginBackgroundColor !== '@@loginBackgroundColor@@') ||
            (window.loginBackgroundImage && window.loginBackgroundImage !== '@@loginBackgroundImage@@')
                ? { background: '#00000000' }
                : {};

        let content: React.JSX.Element;
        if (this.state.loggingIn) {
            content = (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    ...
                </div>
            );
        } else {
            content = (
                <Paper sx={styles.paper}>
                    <Grid2
                        container
                        direction="column"
                        alignItems="center"
                    >
                        {window.loginLogo && window.loginLogo !== '@@loginLogo@@' ? (
                            <Box
                                sx={{
                                    height: 50,
                                    width: 102,
                                    lineHeight: '50px',
                                    backgroundColor: (theme: IobTheme) =>
                                        theme.palette.mode === 'dark' ? '#000' : '#fff',
                                    borderRadius: '5px',
                                    padding: '5px',
                                }}
                            >
                                <img
                                    src={window.loginLogo}
                                    alt="logo"
                                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                                />
                            </Box>
                        ) : window.loginHideLogo === 'false' || window.loginHideLogo === '@@loginHideLogo@@' ? (
                            <Logo color={this.state.themeType === 'dark' ? '#FFF' : '#000'} />
                        ) : null}
                        <Typography
                            component="h1"
                            variant="h5"
                        >
                            {window.loginTitle && window.loginTitle !== '@@loginTitle@@'
                                ? window.loginTitle
                                : I18n.t('loginTitle')}
                        </Typography>
                        {window.location.search.includes('error') || this.state.error ? (
                            <div style={styles.alert}>{this.state.error || I18n.t('wrongPassword')}</div>
                        ) : null}
                        <form
                            ref={this.formRef}
                            style={styles.form}
                            action={action}
                            method="post"
                        >
                            <TextField
                                variant="outlined"
                                margin="normal"
                                disabled={this.state.inProcess}
                                required
                                value={this.state.username}
                                onChange={e => this.setState({ username: e.target.value })}
                                fullWidth
                                size="small"
                                id="username"
                                label={I18n.t('enterLogin')}
                                name="username"
                                autoComplete="username"
                                autoFocus
                            />
                            <TextField
                                variant="outlined"
                                margin="normal"
                                disabled={this.state.inProcess}
                                required
                                fullWidth
                                ref={this.passwordRef}
                                value={this.state.password}
                                onChange={e => this.setState({ password: e.target.value })}
                                slotProps={{
                                    input: {
                                        endAdornment: this.state.password ? (
                                            <IconButton
                                                tabIndex={-1}
                                                aria-label="toggle password visibility"
                                            >
                                                <Visibility
                                                    onMouseDown={() => this.setState({ showPassword: true })}
                                                    onMouseUp={() => {
                                                        this.setState({ showPassword: false }, () => {
                                                            setTimeout(() => this.passwordRef.current?.focus(), 50);
                                                        });
                                                    }}
                                                />
                                            </IconButton>
                                        ) : null,
                                    },
                                }}
                                size="small"
                                name="password"
                                label={I18n.t('enterPassword')}
                                type={this.state.showPassword ? 'text' : 'password'}
                                id="password"
                                autoComplete="current-password"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        id="stayloggedin"
                                        name="stayloggedin"
                                        value="on"
                                        checked={this.state.stayLoggedIn}
                                        onChange={e => this.setState({ stayLoggedIn: e.target.checked })}
                                        color="primary"
                                        disabled={this.state.inProcess}
                                    />
                                }
                                label={I18n.t('staySignedIn')}
                            />
                            <input
                                id="origin"
                                type="hidden"
                                name="origin"
                                value={window.location.pathname + window.location.search.replace('&error', '')}
                            />
                            {
                                <Button
                                    type="submit"
                                    disabled={this.state.inProcess || !this.state.username || !this.state.password}
                                    onClick={() => {
                                        if (window.loginOauth2 === 'false') {
                                            this.formRef.current?.submit();
                                            // give time to firefox to send the data
                                            setTimeout(() => this.setState({ inProcess: true }), 50);
                                        } else {
                                            this.setState({ inProcess: true, error: '' }, async () => {
                                                const response = await fetch('../oauth/token', {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/x-www-form-urlencoded',
                                                    },
                                                    body: `grant_type=password&username=${this.state.username}&password=${this.state.password}&stayloggedin=${this.state.stayLoggedIn}&client_id=ioBroker`,
                                                });
                                                if (await Login.processTokenAnswer(this.state.stayLoggedIn, response)) {
                                                    this.setState({ inProcess: false });
                                                } else {
                                                    this.setState({
                                                        inProcess: false,
                                                        error: I18n.t('wrongPassword'),
                                                    });
                                                }
                                            });
                                        }
                                    }}
                                    fullWidth
                                    variant="contained"
                                    color="primary"
                                    style={styles.submit}
                                >
                                    {this.state.inProcess ? <CircularProgress size={24} /> : I18n.t('login')}
                                </Button>
                            }
                        </form>
                    </Grid2>
                    <Box style={styles.marginTop}>
                        <Typography
                            variant="body2"
                            color="textSecondary"
                            align="center"
                        >
                            {window.loginLink && window.loginLink !== '@@loginLink@@' ? (
                                <Link
                                    style={styles.ioBrokerLink}
                                    color="inherit"
                                    href={link}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                >
                                    {motto}
                                </Link>
                            ) : null}
                            {!window.loginLink || window.loginLink === '@@loginLink@@' ? motto : null}
                            {!window.loginLink || window.loginLink === '@@loginLink@@' ? (
                                <Link
                                    style={styles.ioBrokerLink}
                                    color="inherit"
                                    href={link}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                >
                                    ioBroker
                                </Link>
                            ) : null}
                        </Typography>
                    </Box>
                </Paper>
            );
        }

        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    {this.state.themeName !== 'PT' && this.state.themeName !== 'DX' ? (
                        <ToggleThemeMenu
                            t={I18n.t}
                            style={{ position: 'absolute', top: 10, right: 10 }}
                            themeName={this.state.themeName}
                            toggleTheme={() => this.toggleTheme()}
                        />
                    ) : null}
                    <Paper
                        className={this.state.themeType === 'dark' ? 'theme-dark' : 'theme-light'}
                        component="main"
                        style={{ ...styles.root, ...style }}
                    >
                        {content}
                    </Paper>
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}

export default Login;
