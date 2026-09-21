import {isRouteErrorResponse} from 'react-router';
import {boundary} from '@shopify/shopify-app-react-router/server';

// The SDK checks constructor.name, which changes in a minified client build.
// Use React Router's structural guard before passing its response to the SDK.
export function shopifyBoundaryError(error: unknown) {
  return boundary.error(isRouteErrorResponse(error)
    ? {...error, constructor: {name: 'ErrorResponse'}}
    : error);
}
