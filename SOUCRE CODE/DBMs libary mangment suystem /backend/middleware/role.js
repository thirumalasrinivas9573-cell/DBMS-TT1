/**
 * Role-Based Access Control Middleware
 */

/**
 * Ensures the authenticated user has one of the required roles
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access forbidden: Required role [${allowedRoles.join(' or ')}]. Your role: ${req.user.role}`
      });
    }

    next();
  };
};

/**
 * Ensures a librarian can only operate on data within their assigned library.
 * Admins bypass this restriction.
 */
const requireOwnLibrary = (getLibraryIdFromReq) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    // Admins have network-wide authority
    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (req.user.role === 'LIBRARIAN') {
      const targetLibId = typeof getLibraryIdFromReq === 'function'
        ? getLibraryIdFromReq(req)
        : (req.params.library_id || req.body.library_id || req.query.library_id);

      if (!req.user.library_id) {
        return res.status(403).json({
          success: false,
          error: 'Librarian account is not assigned to any library branch.'
        });
      }

      if (targetLibId !== undefined && targetLibId !== null && Number(targetLibId) !== Number(req.user.library_id)) {
        return res.status(403).json({
          success: false,
          error: `Permission denied: As a librarian of Library #${req.user.library_id}, you cannot modify data belonging to Library #${targetLibId}.`
        });
      }

      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Access denied: Requires LIBRARIAN or ADMIN privileges.'
    });
  };
};

module.exports = {
  requireRole,
  requireOwnLibrary
};
