Feature: Register
  Validate the register form

  Scenario: Successful registration
    Given The register page is open
    When I enter a specific email and username, "PrUeBa" as the password and submit
    Then I should see a message containing "Registro enviado. Ya puedes iniciar sesión."