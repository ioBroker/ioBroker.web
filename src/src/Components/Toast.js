import React from 'react';
import PropTypes from 'prop-types';

import { IconButton, Snackbar } from '@mui/material';

import { MdClose as IconClose } from 'react-icons/md';

import { I18n } from '@iobroker/adapter-react-v5';

const Toast = ({ message, onClose }) => {
    if (!message) {
        return null;
    }
    return <Snackbar
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
        }}
        open
        autoHideDuration={6000}
        onClose={onClose}
        ContentProps={{ 'aria-describedby': 'message-id' }}
        message={<span id="message-id">{I18n.t(message)}</span>}
        action={[
            <IconButton
                key="close"
                aria-label="Close"
                color="inherit"
                onClick={onClose}
            >
                <IconClose />
            </IconButton>,
        ]}
    />;
};

Toast.defaultProps = {
    message: '',
    onClose: () => { },
};

Toast.propTypes = {
    onClose: PropTypes.func,
    message: PropTypes.string,
};

export default Toast;
