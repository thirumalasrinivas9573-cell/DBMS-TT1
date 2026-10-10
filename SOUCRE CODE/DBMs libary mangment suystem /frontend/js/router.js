/**
 * Client-Side Router with Role Guards
 */
const Router = {
  routes: {
    '': () => HomeView.render(Router.getContainer()),
    'home': () => HomeView.render(Router.getContainer()),
    'books': (params) => BooksView.render(Router.getContainer(), params),
    'book-details': (params) => BookDetailView.render(Router.getContainer(), params),
    'libraries': () => LibrariesView.render(Router.getContainer()),
    'login': () => AuthView.renderLogin(Router.getContainer()),
    'register': () => AuthView.renderRegister(Router.getContainer()),

    // Member routes
    'member-dashboard': () => Router.guard(['MEMBER', 'ADMIN'], () => MemberView.render(Router.getContainer(), 'dashboard')),
    'my-books': () => Router.guard(['MEMBER', 'ADMIN'], () => MemberView.render(Router.getContainer(), 'my-books')),
    'history': () => Router.guard(['MEMBER', 'ADMIN'], () => MemberView.render(Router.getContainer(), 'history')),
    'profile': () => Router.guard(['MEMBER', 'LIBRARIAN', 'ADMIN'], () => MemberView.render(Router.getContainer(), 'profile')),
    'notifications': () => Router.guard(['MEMBER', 'LIBRARIAN', 'ADMIN'], () => NotificationsView.render(Router.getContainer())),

    // Librarian routes
    'librarian-dashboard': () => Router.guard(['LIBRARIAN', 'ADMIN'], () => LibrarianView.render(Router.getContainer(), 'dashboard')),
    'scan': () => Router.guard(['LIBRARIAN', 'ADMIN'], () => LibrarianView.render(Router.getContainer(), 'scan')),
    'counter': () => Router.guard(['LIBRARIAN', 'ADMIN'], () => LibrarianView.render(Router.getContainer(), 'counter')),
    'copies': () => Router.guard(['LIBRARIAN', 'ADMIN'], () => LibrarianView.render(Router.getContainer(), 'copies')),
    'copy-tracker': () => Router.guard(['LIBRARIAN', 'ADMIN'], () => LibrarianView.render(Router.getContainer(), 'tracker')),
    'wrong-rack': () => Router.guard(['LIBRARIAN', 'ADMIN'], () => LibrarianView.render(Router.getContainer(), 'wrong-rack')),
    'transfers': () => Router.guard(['LIBRARIAN', 'ADMIN'], () => LibrarianView.render(Router.getContainer(), 'transfers')),
    'reports': () => Router.guard(['LIBRARIAN', 'ADMIN'], () => LibrarianView.render(Router.getContainer(), 'dashboard')),

    // Admin routes
    'admin-dashboard': () => Router.guard(['ADMIN'], () => AdminView.render(Router.getContainer(), 'dashboard')),
    'admin-settings': () => Router.guard(['ADMIN'], () => AdminView.render(Router.getContainer(), 'settings')),
    'manage-libraries': () => Router.guard(['ADMIN'], () => AdminView.render(Router.getContainer(), 'libraries')),
    'manage-users': () => Router.guard(['ADMIN'], () => AdminView.render(Router.getContainer(), 'users')),
    'admin-reports': () => Router.guard(['ADMIN'], () => AdminView.render(Router.getContainer(), 'dashboard')),
    'admin-dbms-concepts': () => Router.guard(['ADMIN'], () => AdminView.render(Router.getContainer(), 'dbms-concepts'))
  },

  getContainer() {
    return document.getElementById('app-container');
  },

  guard(allowedRoles, callback) {
    const user = Auth.getUser();
    if (!user) {
      Toast.warning('Please log in to access this page.');
      window.location.hash = '#login';
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      Toast.error(`Access restricted. Requires [${allowedRoles.join(' or ')}] role.`);
      window.location.hash = '#home';
      return;
    }

    callback();
  },

  navigate() {
    const hash = window.location.hash.slice(1);
    const [path, queryString] = hash.split('?');
    const params = {};

    if (queryString) {
      new URLSearchParams(queryString).forEach((val, key) => {
        params[key] = val;
      });
    }

    const handler = this.routes[path] || this.routes['home'];
    Auth.renderNav();
    window.scrollTo(0, 0);

    try {
      handler(params);
    } catch (err) {
      console.error('Routing render error:', err);
      this.getContainer().innerHTML = `<div class="card empty-state"><div class="empty-state-title" style="color:var(--rose-500)">View Rendering Error</div><p>${err.message}</p></div>`;
    }
  },

  init() {
    window.addEventListener('hashchange', () => this.navigate());
    this.navigate();
  }
};

window.Router = Router;
