import React, { Component } from 'react';

import { I18n } from '@iobroker/adapter-react-v5';

class Certificates extends Component {
    render() {
        return <div style={{ fontSize: 20 }}>
            {I18n.t('Use %s adapter to get letsencrypt certificates.', 'iobroker.acme')}
        </div>;
    }
}

export default Certificates;
