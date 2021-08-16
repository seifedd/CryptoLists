//Example app tests
describe('Visit login page ', () => {
  beforeEach(() => {
    cy.visit('/');
  });
  it('Login page..', () => {
    //I should see the welcome message
    cy.get('.welcome').should('exist');
    cy.get('.welcome')
      .should('exist')
      .contains('Log in to get started');

    //should not see the current balance
    cy.get('.balance').should('not.be.visible');

    //check the elements within the login form
    cy.get('.login').within(() => {
      cy.get('.login__input--user').should('have.attr', 'placeholder', 'user');
      cy.get('.login__input--pin').should('have.attr', 'placeholder', 'PIN');
    });

    //should not have access with the wrong login

    cy.get('.login__input--user').type(userID_generator());
    cy.get('.login__input--pin').type(PIN_generator());
    cy.get('.login__btn').should('be.visible');

    cy.get('.balance').should('not.be.visible');
  });
});

function userID_generator() {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  for (var i = 0; i < 4; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

function PIN_generator() {
  var text = '';
  var possible = '0123456789';

  for (var i = 0; i < 4; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}
