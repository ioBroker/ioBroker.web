import React, { useState } from 'react';

import { ClickAwayListener, Fab, Tooltip } from '@mui/material';

import { HelpOutlineOutlined } from '@mui/icons-material';

import { I18n, type IobTheme } from '@iobroker/adapter-react-v5';

const styles: Record<string, any> = {
    colorTheme: (theme: IobTheme): React.CSSProperties => ({
        color: theme.palette.mode === 'dark' ? '#a2a2a2;' : '#c0c0c0',
        backgroundColor: theme.palette.mode === 'dark' ? '#ffffff00' : '#ffffff',
    }),
};

interface HintComponentProps {
    children: string;
    openLink: () => void;
    style: Record<string, any>;
}

export function HintComponent(props: HintComponentProps): React.JSX.Element {
    const { children, openLink, style } = props;
    const [open, setOpen] = useState(false);
    return (
        <ClickAwayListener onClickAway={() => setOpen(false)}>
            <Tooltip
                arrow
                placement="top"
                title={I18n.t(children || 'link')}
                open={open}
                onOpen={() => setOpen(true)}
            >
                <Fab
                    sx={styles.colorTheme}
                    style={{
                        boxShadow: 'none',
                        marginLeft: 10,
                        width: 20,
                        height: 20,
                        minHeight: 20,
                        ...style,
                    }}
                    size="small"
                    aria-label="like"
                    onClick={() => {
                        setOpen(!open);
                        openLink?.();
                    }}
                >
                    <HelpOutlineOutlined />
                </Fab>
            </Tooltip>
        </ClickAwayListener>
    );
}
