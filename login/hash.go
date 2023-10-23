package login

import (
	"fmt"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"
	"os"
	"syscall"
)

func GenerateHash() {
	fmt.Printf("Password: ")
	p1, err := term.ReadPassword(syscall.Stdin)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("\n")

	if len(p1) == 0 {
		fmt.Println("Error: invalid password")
		os.Exit(1)
	}
	if len(p1) < 5 {
		fmt.Println("Error: this password is too short.")
		os.Exit(1)
	}

	fmt.Printf("Repeat password: ")
	p2, err := term.ReadPassword(syscall.Stdin)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("\n")

	if string(p1) != string(p2) {
		fmt.Println("Error: two passwords mismatch")
		os.Exit(1)
	}

	hash, err := bcrypt.GenerateFromPassword(p1, bcrypt.DefaultCost)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Your password hash: %s\n", hash)
	fmt.Printf("Notice: If you'd like to use this in a shell, " +
		"it should be properly escaped or quoted within single quotation marks.\n")

	os.Exit(0)
}
