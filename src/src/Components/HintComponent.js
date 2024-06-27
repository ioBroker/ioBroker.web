import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { ClickAwayListener, Fab, Tooltip } from '@mui/material';

import { HelpOutlineOutlinedIcon } from '@mui/icons-material';

import { I18n } from '@iobroker/adapter-react-v5';

const styles = {
    colorTheme: theme => ({
        color: theme.palette.mode === 'dark' ? '#a2a2a2;' : '#c0c0c0',
        backgroundColor: theme.palette.mode === 'dark' ? '#ffffff00' : '#ffffff',
    }),
};

const HintComponent = ({ children, openLink, style }) => {
    const [open, setOpen] = useState(false);
    return <ClickAwayListener onClickAway={() => setOpen(false)}>
        <Tooltip
            arrow
            placement="top"
            title={I18n.t(children)}
            interactive
            open={open}
            onOpen={() => setOpen(true)}
        >
            <Fab
                sx={styles.colorTheme}
                style={({
                    boxShadow: 'none',
                    marginLeft: 10,
                    width: 20,
                    height: 20,
                    minHeight: 20,
                    ...style,
                })}
                size="small"
                aria-label="like"
                onClick={() => {
                    setOpen(!open);
                    openLink();
                }}
            >
                <HelpOutlineOutlinedIcon />
            </Fab>
        </Tooltip>
    </ClickAwayListener>;
};

HintComponent.defaultProps = {
    children: 'link',
    openLink: () => { },
    style: {},
};

HintComponent.propTypes = {
    children: PropTypes.string,
    openLink: PropTypes.func,
    style: PropTypes.object,
};

export default HintComponent;
