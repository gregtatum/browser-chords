import * as React from 'react';
import * as Redux from 'react-redux';
import { A, $ } from 'src';

import './Messages.css';

export function Messages() {
  const dispatch = Redux.useDispatch();
  const messages = Redux.useSelector($.getMessages);

  React.useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        dispatch(A.dismissAllMessages());
      }
    }
    window.addEventListener('keydown', onKeydown);
    return () => {
      window.removeEventListener('keydown', onKeydown);
    };
  }, []);

  return (
    <div className="messages">
      {messages.map(({ message, generation }) => (
        <div className="messagesMessage" key={generation}>
          {message}
          <button
            type="button"
            onClick={() => {
              dispatch(A.dismissMessage(generation));
            }}
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
