describe('example app tests', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('Login page..', () => {
    //should see the welcome message
    cy.get('.welcome').should('exist');
    cy.get('.welcome')
      .should('exist')
      .contains('Log in');

    //should not see the current balance
    cy.get('.balance').should('not.be.visible');

    //check elements whithin the login form
    cy.get('.login').within(() => {
      cy.get('.login__input--user').should('have.attr', 'placeholder', 'user');
      cy.get('.login__input--pin').should('have.attr', 'placeholder', 'PIN');
    });

    // should not have access with the wrong login

    cy.get('.login__input--user').type(userID_generator());
    cy.get('.login__input--pin').type(PIN_generator());
    cy.get('.login__btn')
      .contains('→')
      .should('be.visible');
    cy.get('.balance').should('not.be.visible');
  });

  //should have access with the right login
});
